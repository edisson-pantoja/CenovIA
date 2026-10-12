import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verifyWebSocketToken } from '../middleware/auth';
import { UsageService } from '../services/usage-service';
import { normalizeBoardCall } from './board-normalizer';
import { applyStudyPlanCall, describeStudyPlan, emptyStudyPlan } from './study-plan';
import type { StudyPlanState } from '@cenovia/shared';
import config from '../config';

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${config.geminiApiKey}`;

export const handleRelayConnection = (clientWs: WebSocket, request: IncomingMessage) => {
  let geminiWs: WebSocket | null = null;
  let userId: string | null = null;
  let usageInterval: NodeJS.Timeout | null = null;
  let keepaliveInterval: NodeJS.Timeout | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isAuthenticated = false;
  let hasInputInCurrentTurn = false;
  let studyContext: any = null;
  let sessionStartMs = Date.now();
  let resumptionHandle: string | null = null;
  let connectionResumed = false;
  let pttPending = false;
  let pttStarted = false;
  let studyPlan: StudyPlanState = emptyStudyPlan();
  let isInitialConnection = true;
  let reconnectAttempts = 0;

  /** Fecha tudo (chamado somente quando o cliente desconecta) */
  const fullCleanup = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    if (usageInterval) clearInterval(usageInterval);
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    keepaliveInterval = null;
    usageInterval = null;
    geminiWs = null;
  };

  /** Fecha somente a conexão Gemini (mantém o frontend vivo) */
  const closeGeminiOnly = () => {
    if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
    if (geminiWs) {
      geminiWs.removeAllListeners();
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
      geminiWs = null;
    }
  };

  /** Agenda reconexão com backoff exponencial (1s, 2s, 4s, máx 3 tentativas) */
  const scheduleReconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    closeGeminiOnly();

    if (clientWs.readyState !== WebSocket.OPEN) return;

    if (reconnectAttempts >= 3) {
      console.error('[RELAY] Máximo de 3 tentativas de reconexão atingido.');
      clientWs.send(JSON.stringify({
        type: 'error',
        code: 'GEMINI_DISCONNECTED',
        message: 'Conexão com a IA perdida após várias tentativas.'
      }));
      return;
    }

    reconnectAttempts++;
    const backoffMs = Math.pow(2, reconnectAttempts - 1) * 1000;
    console.log(`[RELAY] Reconectando ao Gemini em ${backoffMs}ms (tentativa ${reconnectAttempts}/3, handle=${resumptionHandle || 'novo'})...`);

    clientWs.send(JSON.stringify({
      type: 'teacher_state',
      state: 'reconnecting'
    }));

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      if (clientWs.readyState === WebSocket.OPEN) {
        connectToGemini(studyContext);
      }
    }, backoffMs);
  };

  /** Monta e conecta ao Gemini Live API */
  const connectToGemini = (context: any) => {
    closeGeminiOnly();

    geminiWs = new WebSocket(GEMINI_WS_URL);

    geminiWs.on('open', async () => {
      connectionResumed = !!resumptionHandle;
      console.log(`[RELAY] Conectado ao Gemini Live para usuário ${userId} (resumed=${!isInitialConnection}, handle=${resumptionHandle || 'none'})`);

      const systemInstruction = `Você é CenovIA, uma professora particular afetuosa, paciente e muito didática de ${context?.subjectName || 'várias matérias'} para ${context?.gradeLabel || 'o aluno'}.
Responda SEMPRE em português do Brasil, com linguagem clara, acolhedora e adequada para o nível do aluno.
Quando explicar algo que precisa de visualização, fórmulas ou anotações, use SEMPRE a ferramenta draw_board.
Regras fundamentais de uso do quadro verde:
- Sempre que for começar uma nova explicação, mudar de tópico ou responder uma nova dúvida do aluno, use SEMPRE clear: true para apagar o quadro anterior antes de escrever.
- O quadro organiza o layout SOZINHO: os elementos são dispostos em ordem de leitura, em duas colunas, sem sobreposição. Não se preocupe com x e y (pode omiti-los). O que importa é a ORDEM em que você envia os elementos.
- Seja ECONÔMICA no quadro: no máximo 5 elementos por tela (1 título, até 3 textos/fórmulas curtos e, se couber, 1 note_box curto). Cada texto com no máximo ~100 caracteres. Se precisar de mais, use clear: true e escreva uma nova tela.
- Toda fórmula matemática vai como kind: 'latex' (escreva o código LaTeX sem cifrões $).
- Use kind: 'title' amarelo para o tema da explicação (sempre o primeiro elemento da tela).
- Use kind: 'note_box' rosa para resumos, destaques e caixas 'Lembre-se:' (máximo 3 linhas curtas).
- Escreva no quadro ANTES de explicar em voz.

ESTILO DAS EXPLICAÇÕES:
- Explique com mais detalhe do que uma resposta rápida: cerca de 20 a 30 segundos de fala por resposta (aproximadamente 5 a 8 frases), com contexto, um exemplo concreto ou uma analogia do dia a dia. Não faça monólogos maiores que isso: o aluno não pode ficar entediado.
- Ao final de cada explicação, faça UMA pergunta curta para checar o entendimento ou convide o aluno a participar.

CÂMERA DO ALUNO:
- Quando o aluno ligar a câmera, você passa a receber imagens do vídeo dele (cerca de 1 por segundo). Use isso: se ele mostrar o caderno ou um exercício, leia e comente o que está escrito; se ele levantar a mão, fizer um gesto ou parecer confuso, reaja com naturalidade (ex.: "vi que você levantou a mão, qual é a dúvida?"). Se não conseguir ler algo, peça para aproximar o caderno da câmera. Nunca diga que não consegue ver quando as imagens estão chegando.
Se o aluno interromper você, pare de falar imediatamente e escute.
Seja encorajadora e positiva. Celebre quando o aluno acertar.
Ao iniciar a sessão, cumprimente o aluno de forma calorosa e pergunte o que ele gostaria de aprender hoje.

PLANO DE ESTUDOS (obrigatório, use a ferramenta study_plan):
1. Quando o aluno disser o tema (ex.: "divisão celular"), monte uma lista de 4 a 7 tópicos em ordem didática com study_plan action 'create'. Diga os tópicos em voz alta e PERGUNTE se é isso que ele quer estudar e se quer pular ou incluir algum. Só depois da resposta use action 'confirm'.
2. Se o aluno pedir para pular/retirar um tópico, use action 'remove'; para incluir, 'add'.
3. Ensine UM tópico por vez, na ordem. Ao começar um tópico use 'set_current'; ao terminar de explicá-lo e confirmar que o aluno entendeu, use 'complete' (o painel lateral marca com ✔ automaticamente).
4. O painel lateral mostra a lista de forma permanente: NÃO reescreva a lista de tópicos no quadro verde. Use o quadro só para explicar o tópico atual.
5. Se o aluno pedir para aprofundar ou tirar uma dúvida, responda sem mudar o tópico atual do plano. Depois de responder, pergunte "Podemos voltar ao plano de estudos?" e retome exatamente o tópico atual.
6. Se o aluno ficar em silêncio ou disser algo como "ok", pergunte "Podemos seguir com a aula?"; se ele responder que sim, continue no tópico atual (nunca volte ao início da lista).
7. Quando todos os tópicos estiverem concluídos, faça um breve resumo e pergunte se ele quer revisar algo ou estudar outro tema.${describeStudyPlan(studyPlan)}`;

      const modelName = config.geminiModel.startsWith('models/')
        ? config.geminiModel
        : `models/${config.geminiModel}`;

      const setupMessage = {
        setup: {
          model: modelName,
          ...(resumptionHandle
            ? { sessionResumption: { handle: resumptionHandle } }
            : { sessionResumption: {} }),
          contextWindowCompression: {
            slidingWindow: {}
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [{
            functionDeclarations: [{
              name: 'draw_board',
              description: 'Escreve no quadro verde. Use SEMPRE que explicar algo visual. Pode enviar vários elementos de uma vez.',
              parameters: {
                type: 'object',
                properties: {
                  clear: { type: 'boolean', description: 'true para apagar o quadro antes de escrever' },
                  elements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        kind: { type: 'string', enum: ['title', 'text', 'latex', 'note_box', 'underline'] },
                        content: { type: 'string', description: 'Texto ou LaTeX (sem $). Em note_box, linhas separadas por \\n' },
                        color: { type: 'string', enum: ['white', 'yellow', 'pink', 'blue', 'green'] },
                        x: { type: 'number', description: '0 a 1 (esquerda→direita)' },
                        y: { type: 'number', description: '0 a 1 (topo→base)' },
                      },
                      required: ['kind', 'content'],
                    },
                  },
                },
                required: ['elements'],
              },
            }, {
              name: 'study_plan',
              description: 'Gerencia a lista fixa de tópicos de estudo exibida no painel lateral do aluno. Use para criar, confirmar, marcar o tópico atual, concluir, remover ou adicionar tópicos.',
              parameters: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['create', 'confirm', 'set_current', 'complete', 'remove', 'add'] },
                  theme: { type: 'string', description: 'Tema geral (apenas em create)' },
                  topics: { type: 'array', items: { type: 'string' }, description: 'Títulos dos tópicos em ordem (apenas em create)' },
                  topic: { type: 'string', description: 'id (ex.: t2), posição (1,2,3...) ou parte do título do tópico alvo' },
                  title: { type: 'string', description: 'Título do novo tópico (apenas em add)' },
                },
                required: ['action'],
              },
            }],
          }],
          // Desabilita o VAD automático para termos controle total (modelo PTT)
          // Com VAD desabilitado, usamos activityStart/activityEnd para definir as fronteiras de fala
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: true
            }
          },
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede'
                }
              }
            }
          }
        }
      };

      geminiWs!.send(JSON.stringify(setupMessage));

      // Keepalive: envia ping de WebSocket a cada 15 segundos para manter o Gemini vivo
      keepaliveInterval = setInterval(() => {
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          try {
            geminiWs.ping();
          } catch (e) {
            console.warn('[RELAY] Falha no keepalive ping:', e);
          }
        }
      }, 15000);

      // Incrementa uso a cada 30 segundos
      if (!usageInterval) {
        usageInterval = setInterval(async () => {
          if (userId) {
            await UsageService.incrementUsage(userId, 0.5);
            const stillHasMinutes = await UsageService.hasMinutesRemaining(userId);
            if (!stillHasMinutes) {
              clientWs.send(JSON.stringify({ type: 'usage_limit_reached' }));
              fullCleanup();
            }
          }
        }, 30000);
      }
    });

    geminiWs.on('message', async (geminiData, geminiIsBinary) => {
      if (clientWs.readyState !== WebSocket.OPEN) return;

      const geminiMsgStr = Buffer.isBuffer(geminiData)
        ? (geminiData as Buffer).toString('utf8')
        : Array.isArray(geminiData)
          ? Buffer.concat(geminiData as Buffer[]).toString('utf8')
          : geminiData.toString();

      try {
        const geminiJson = JSON.parse(geminiMsgStr);

        if (geminiJson.error) {
          console.error('[RELAY] Gemini API retornou erro:', JSON.stringify(geminiJson.error));
          clientWs.send(JSON.stringify({ type: 'error', code: 'GEMINI_API_ERROR', message: geminiJson.error.message || 'Erro na API da IA' }));
          return;
        }

        // Atualização de handle de retomada da sessão (Session Resumption)
        if (geminiJson.sessionResumptionUpdate?.newHandle) {
          resumptionHandle = geminiJson.sessionResumptionUpdate.newHandle;
          console.log(`[RELAY] Novo resumption handle salvo: ${resumptionHandle}`);
        }

        // Sinal de goAway do Gemini (sessão chegando ao limite de tempo)
        if (geminiJson.goAway) {
          console.log('[RELAY] Gemini enviou goAway — agendando reconexão limpa com resumption handle');
          scheduleReconnect();
          return;
        }

        // setupComplete: notifica o cliente que a sessão está pronta
        if (geminiJson.setupComplete && userId) {
          reconnectAttempts = 0;

          if (isInitialConnection) {
            isInitialConnection = false;
            sessionStartMs = Date.now();
            const currentUsage = await UsageService.getUserUsage(userId, new Date().toISOString().slice(0, 7));
            clientWs.send(JSON.stringify({
              type: 'session_ready',
              sessionId: Math.random().toString(36).substring(7),
              usage: currentUsage
            }));

            // Envia uma saudação inicial: confirma que o pipeline está vivo e apresenta a professora
            console.log('[RELAY] setupComplete inicial recebido — enviando saudação');
            geminiWs!.send(JSON.stringify({
              clientContent: {
                turns: [{ role: 'user', parts: [{ text: 'Olá, estou pronto para a aula!' }] }],
                turnComplete: true
              }
            }));
          } else {
            console.log(`[RELAY] Sessão Gemini reconectada (${connectionResumed ? 'com handle' : 'sessão nova, reinjetando plano'})`);
            clientWs.send(JSON.stringify({ type: 'teacher_state', state: 'idle' }));
            if (!connectionResumed && geminiWs && geminiWs.readyState === WebSocket.OPEN) {
              // Sessão nova (contexto perdido): retoma do ponto em que estávamos usando o plano de estudos
              geminiWs.send(JSON.stringify({
                clientContent: {
                  turns: [{ role: 'user', parts: [{ text: 'A conexão caiu e foi restabelecida. Peça desculpas em uma frase curta e retome a aula exatamente no tópico atual do plano de estudos (se houver), sem recomeçar do zero.' }] }],
                  turnComplete: true
                }
              }));
            }
          }
        }

        // Sinaliza quando o aluno interrompe a professora
        if (geminiJson?.serverContent?.interrupted) {
          console.log('[RELAY] Gemini interrompido pelo usuário');
          clientWs.send(JSON.stringify({ type: 'teacher_state', state: 'interrupted' }));
        }

        // Sinaliza quando a professora terminou de falar
        if (geminiJson?.serverContent?.turnComplete) {
          clientWs.send(JSON.stringify({ type: 'teacher_state', state: 'idle' }));
        }

        // Trata tool calls (desenho no quadro verde) e responde imediatamente
        if (geminiJson.toolCall?.functionCalls) {
          const responses = [];
          for (const fc of geminiJson.toolCall.functionCalls) {
            if (fc.name === 'draw_board') {
              console.log('[RELAY] draw_board function call:', JSON.stringify(fc.args));
              const events = normalizeBoardCall(fc.args, sessionStartMs);
              for (const ev of events) {
                clientWs.send(JSON.stringify({ type: 'board_event', event: ev }));
              }
            }
            if (fc.name === 'study_plan') {
              console.log('[RELAY] study_plan function call:', JSON.stringify(fc.args));
              const { plan, result } = applyStudyPlanCall(studyPlan, fc.args);
              studyPlan = plan;
              clientWs.send(JSON.stringify({ type: 'study_plan', plan: studyPlan }));
              responses.push({ id: fc.id, name: fc.name, response: result });
              continue;
            }
            responses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
          }
          if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
          }
        }

        if (geminiJson.toolCallCancellation) {
          console.log('[RELAY] Tool call cancelada:', geminiJson.toolCallCancellation);
        }

        // Processa partes do modelo (áudio nativo)
        if (geminiJson?.serverContent?.modelTurn?.parts) {
          const parts = geminiJson.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
              clientWs.send(JSON.stringify({
                type: 'audio_chunk',
                data: part.inlineData.data,
                timestampMs: Date.now(),
                mimeType: part.inlineData.mimeType,
              }));
            }
          }
        }
      } catch (e) {
        console.warn('[RELAY] Mensagem não-JSON do Gemini descartada');
      }
    });

    geminiWs.on('close', (code, reason) => {
      console.log(`[RELAY] Gemini connection closed: code=${code} reason=${reason?.toString()}`);
      if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
      geminiWs = null;
      pttPending = false;
      pttStarted = false;

      // 1007/1008: a sessão foi invalidada pelo Gemini — o handle não serve mais, recomeça limpo
      if (code === 1007 || code === 1008) {
        resumptionHandle = null;
      }

      if (clientWs.readyState === WebSocket.OPEN) {
        scheduleReconnect();
      }
    });

    geminiWs.on('error', (err) => {
      console.error('[RELAY] Gemini WS error:', err);
      if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
      geminiWs = null;

      if (clientWs.readyState === WebSocket.OPEN) {
        scheduleReconnect();
      }
    });
  };

  // ── Mensagens do frontend ──────────────────────────────────────────────────

  clientWs.on('message', async (data, isBinary) => {
    if (isBinary) {
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN && isAuthenticated) {
        geminiWs.send(data, { binary: true });
      }
      return;
    }

    const messageStr = data.toString();
    try {
      const msg = JSON.parse(messageStr);

      if (msg.type === 'session_start') {
        const token = msg.token;
        studyContext = msg.context;

        const uid = await verifyWebSocketToken(token);
        if (!uid) {
          clientWs.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
          clientWs.close();
          return;
        }

        userId = uid;
        const hasMinutes = await UsageService.hasMinutesRemaining(userId);
        if (!hasMinutes) {
          clientWs.send(JSON.stringify({ type: 'usage_limit_reached' }));
          clientWs.close();
          return;
        }

        isAuthenticated = true;
        isInitialConnection = true;
        reconnectAttempts = 0;
        connectToGemini(studyContext);

      } else if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        if (msg.type === 'ptt_start') {
          // Só enviamos activityStart quando chegar o 1º áudio: um toque vazio no PTT
          // (start/end sem áudio) derrubava a sessão com 1007 "Precondition check failed"
          console.log('[RELAY] PTT Start (aguardando áudio)');
          pttPending = true;
          pttStarted = false;
          hasInputInCurrentTurn = true;
        } else if (msg.type === 'audio_chunk') {
          const mimeType = msg.mimeType || 'audio/pcm;rate=16000';
          const base64Data = msg.data as string;

          if (!base64Data || base64Data.length < 10) {
            console.warn('[RELAY] audio_chunk vazio, ignorando');
          } else {
            hasInputInCurrentTurn = true;
            if (pttPending && !pttStarted) {
              console.log('[RELAY] Primeiro áudio -> activityStart');
              geminiWs.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
              pttStarted = true;
            }
            geminiWs.send(JSON.stringify({
              realtimeInput: {
                audio: { data: base64Data, mimeType }
              }
            }));
          }

        } else if (msg.type === 'turn_complete') {
          hasInputInCurrentTurn = false;
          if (pttStarted) {
            console.log('[RELAY] PTT End -> activityEnd');
            geminiWs.send(JSON.stringify({
              realtimeInput: { activityEnd: {} }
            }));
          } else {
            console.log('[RELAY] PTT vazio (sem áudio) — ignorado');
            clientWs.send(JSON.stringify({ type: 'teacher_state', state: 'idle' }));
          }
          pttPending = false;
          pttStarted = false;

        } else if (msg.type === 'video_frame') {
          // Frame da câmera do aluno (JPEG base64) — a professora "vê" o caderno/gestos
          if (typeof msg.data === 'string' && msg.data.length > 100 && msg.data.startsWith('/9j/')) {
            geminiWs.send(JSON.stringify({
              realtimeInput: { video: { data: msg.data, mimeType: 'image/jpeg' } }
            }));
          }

        } else if (msg.type === 'text_message') {
          hasInputInCurrentTurn = false;
          geminiWs.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true
            }
          }));

        } else if (msg.type === 'image_message') {
          console.log('[RELAY] Imagem recebida do aluno');
          hasInputInCurrentTurn = false;
          const mimeType = msg.mimeType || 'image/jpeg';
          const promptText = msg.text || 'Analise a imagem da anotação/exercício enviada e ajude a explicar e resolver no quadro verde.';

          geminiWs.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{ mimeType, data: msg.data }]
            }
          }));

          geminiWs.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: promptText }] }],
              turnComplete: true
            }
          }));
        }
      } else if (isAuthenticated && msg.type !== 'session_end') {
        // Gemini fora do ar: uma ação do aluno reanima a conexão (mesmo após esgotar as tentativas)
        if (!reconnectTimeout && !geminiWs) {
          console.warn('[RELAY] Ação do aluno com Gemini desconectado — reiniciando conexão');
          reconnectAttempts = 0;
          scheduleReconnect();
        }
      }
    } catch (error) {
      console.error('[RELAY] Error parsing client message:', error);
    }
  });

  clientWs.on('close', () => {
    console.log('[RELAY] Client connection closed');
    fullCleanup();
  });

  clientWs.on('error', (err) => {
    console.error('[RELAY] Client WS error:', err);
    fullCleanup();
  });
};
