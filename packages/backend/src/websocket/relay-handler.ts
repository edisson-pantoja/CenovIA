import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verifyWebSocketToken } from '../middleware/auth';
import { UsageService } from '../services/usage-service';
import config from '../config';

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${config.geminiApiKey}`;

export const handleRelayConnection = (clientWs: WebSocket, request: IncomingMessage) => {
  let geminiWs: WebSocket | null = null;
  let userId: string | null = null;
  let usageInterval: NodeJS.Timeout | null = null;
  let keepaliveInterval: NodeJS.Timeout | null = null;
  let isAuthenticated = false;
  let studyContext: any = null;

  /** Fecha tudo (chamado somente quando o cliente desconecta) */
  const fullCleanup = () => {
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
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) { geminiWs.close(); }
    geminiWs = null;
  };

  /** Monta e conecta ao Gemini Live API */
  const connectToGemini = (context: any) => {
    closeGeminiOnly();

    geminiWs = new WebSocket(GEMINI_WS_URL);

    geminiWs.on('open', async () => {
      console.log(`[RELAY] Connected to Gemini for user ${userId}`);

      const systemInstruction = `Você é CenovIA, uma professora particular afetuosa, paciente e muito didática de ${context?.subjectName || 'várias matérias'} para ${context?.gradeLabel || 'o aluno'}.
Responda SEMPRE em português do Brasil, com linguagem clara e adequada para o nível do aluno.
Quando explicar algo que precisa de visualização (fórmulas, diagramas, estruturas), use a função draw_board.
Se o aluno interromper você, pare de falar imediatamente e escute.
Seja encorajadora e positiva. Celebre quando o aluno acertar.
Ao iniciar a sessão, cumprimente o aluno de forma calorosa e pergunte o que ele gostaria de aprender hoje.`;

      const setupMessage = {
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-latest',
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [{
            functionDeclarations: [{
              name: 'draw_board',
              description: 'Escreve ou desenha algo no quadro verde enquanto explica',
              parameters: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['text', 'latex', 'smiles', 'svg_path', 'clear'] },
                  content: { type: 'string', description: 'Texto, LaTeX, SMILES ou SVG path data' },
                  x: { type: 'number', description: 'Posição X de 0 a 1' },
                  y: { type: 'number', description: 'Posição Y de 0 a 1' },
                  label: { type: 'string' }
                },
                required: ['type', 'content']
              }
            }]
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
                  voiceName: 'Puck'
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
            console.log('[RELAY] Keepalive ping enviado ao Gemini');
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

      // gemini-2.5-flash-native-audio-latest envia JSON como frames BINÁRIOS
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

        // setupComplete: notifica o cliente que a sessão está pronta
        if (geminiJson.setupComplete && userId) {
          const currentUsage = await UsageService.getUserUsage(userId, new Date().toISOString().slice(0, 7));
          clientWs.send(JSON.stringify({
            type: 'session_ready',
            sessionId: Math.random().toString(36).substring(7),
            usage: currentUsage
          }));

          // Envia uma saudação inicial: confirma que o pipeline está vivo e apresenta a professora
          console.log('[RELAY] setupComplete recebido — enviando saudação inicial');
          geminiWs!.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: 'Olá, estou pronto para a aula!' }] }],
              turnComplete: true
            }
          }));
        }

        // Sinaliza quando a professora terminou de falar
        if (geminiJson?.serverContent?.turnComplete) {
          clientWs.send(JSON.stringify({ type: 'teacher_state', state: 'idle' }));
        }

        // Intercept board events (function calls)
        if (geminiJson?.serverContent?.modelTurn?.parts) {
          const parts = geminiJson.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.functionCall && part.functionCall.name === 'draw_board') {
              clientWs.send(JSON.stringify({
                type: 'board_event',
                event: part.functionCall.args
              }));
            }
            // Native audio: inline PCM data inside parts
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

        // Não reenvia o JSON bruto do Gemini para o cliente (evita processamento duplo de áudio)
      } catch (e) {
        // Se parsing falhar é um frame binário genuíno — descarta (não deve acontecer com Gemini 2.5)
        console.warn('[RELAY] Mensagem não-JSON do Gemini descartada');
      }
    });

    geminiWs.on('close', (code, reason) => {
      console.log(`[RELAY] Gemini connection closed: code=${code} reason=${reason?.toString()}`);
      if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
      geminiWs = null;
      // Notifica o frontend que o Gemini desconectou (mas não fecha o frontend WS)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'error', code: 'GEMINI_DISCONNECTED', message: 'Conexão com a IA perdida. Reconectando...' }));
      }
    });

    geminiWs.on('error', (err) => {
      console.error('[RELAY] Gemini WS error:', err);
      if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
      geminiWs = null;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'error', code: 'GEMINI_ERROR', message: 'Erro na conexão com a IA' }));
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
        connectToGemini(studyContext);

      } else if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        if (msg.type === 'ptt_start') {
          // Usuário pressionou o botão: no raw websocket, apenas começamos a enviar audio_chunks
          console.log('[RELAY] PTT Start recebido');
        } else if (msg.type === 'audio_chunk') {
          const mimeType = msg.mimeType || 'audio/pcm;rate=16000';
          const base64Data = msg.data as string;

          if (!base64Data || base64Data.length < 10) {
            console.warn('[RELAY] audio_chunk vazio, ignorando');
          } else {
            geminiWs.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{ mimeType, data: base64Data }]
              }
            }));
          }

        } else if (msg.type === 'turn_complete') {
          // Usuário soltou o botão: sinaliza fim de fala → Gemini responde
          console.log('[RELAY] PTT End → turnComplete');
          geminiWs.send(JSON.stringify({
            clientContent: { turnComplete: true }
          }));

        } else if (msg.type === 'text_message') {
          geminiWs.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true
            }
          }));
        }
      } else if (geminiWs && geminiWs.readyState !== WebSocket.OPEN) {
        // Gemini caiu — informa o frontend
        console.warn('[RELAY] Mensagem recebida mas Gemini WS não está aberto, reconectando...');
        connectToGemini(studyContext);
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
