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
  let isAuthenticated = false;

  const cleanup = () => {
    if (usageInterval) {
      clearInterval(usageInterval);
    }
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  };

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
        const context = msg.context;

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

        geminiWs = new WebSocket(GEMINI_WS_URL);

        geminiWs.on('open', async () => {
          console.log(`[RELAY] Connected to Gemini for user ${userId}`);
          
          const systemInstruction = `Você é CenovIA, uma professora particular afetuosa, paciente e muito didática de ${context?.subjectName || 'várias matérias'} para ${context?.gradeLabel || 'o aluno'}. 
Responda SEMPRE em português do Brasil, com linguagem clara e adequada para o nível do aluno.
Quando explicar algo que precisa de visualização (fórmulas, diagramas, estruturas), use a função draw_board.
Se o aluno interromper você, pare de falar imediatamente e escute.
Seja encorajadora e positiva. Celebre quando o aluno acertar.
Apresente-se brevemente e pergunte o que o aluno gostaria de aprender hoje. Aguarde a resposta do aluno antes de continuar.`;

          const setupMessage = {
            setup: {
              model: "models/gemini-2.5-flash-native-audio-latest",
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              tools: [{
                functionDeclarations: [{
                  name: "draw_board",
                  description: "Escreve ou desenha algo no quadro verde enquanto explica",
                  parameters: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["text", "latex", "smiles", "svg_path", "clear"] },
                      content: { type: "string", description: "Texto, LaTeX, SMILES ou SVG path data" },
                      x: { type: "number", description: "Posição X de 0 a 1" },
                      y: { type: "number", description: "Posição Y de 0 a 1" },
                      label: { type: "string" }
                    },
                    required: ["type", "content"]
                  }
                }]
              }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: "Puck"
                    }
                  }
                }
              }
            }
          };

          geminiWs!.send(JSON.stringify(setupMessage));

          // Increment usage every 30 seconds (0.5 minutes)
          usageInterval = setInterval(async () => {
            if (userId) {
              await UsageService.incrementUsage(userId, 0.5);
              const stillHasMinutes = await UsageService.hasMinutesRemaining(userId);
              if (!stillHasMinutes) {
                clientWs.send(JSON.stringify({ type: 'usage_limit_reached' }));
                cleanup();
              }
            }
          }, 30000);
        });

        geminiWs.on('message', async (geminiData, geminiIsBinary) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          // gemini-2.5-flash-native-audio-latest envia JSON como frames BINÁRIOS.
          const geminiMsgStr = Buffer.isBuffer(geminiData)
            ? (geminiData as Buffer).toString('utf8')
            : Array.isArray(geminiData)
              ? Buffer.concat(geminiData as Buffer[]).toString('utf8')
              : geminiData.toString();

          try {
            const geminiJson = JSON.parse(geminiMsgStr);

            // Wait for Gemini to confirm setup before telling the client it's ready
            if (geminiJson.setupComplete && userId) {
              const currentUsage = await UsageService.getUserUsage(userId, new Date().toISOString().slice(0, 7));
              clientWs.send(JSON.stringify({
                type: 'session_ready',
                sessionId: Math.random().toString(36).substring(7),
                usage: currentUsage
              }));
              // A saudação está no system prompt — o modelo falará quando o aluno falar
            }

            // Sinaliza para o frontend quando a professora terminou de falar
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

            // Forward the full JSON message as text to the client
            clientWs.send(geminiMsgStr);
          } catch (e) {
            // If parsing fails (genuine binary audio frame), forward as-is
            clientWs.send(geminiData as Buffer, { binary: true });
          }
        });

        geminiWs.on('close', () => {
          console.log(`[RELAY] Gemini connection closed for user ${userId}`);
          cleanup();
        });

        geminiWs.on('error', (err) => {
          console.error(`[RELAY] Gemini WS error:`, err);
          clientWs.send(JSON.stringify({ type: 'error', message: 'Gemini connection error' }));
          cleanup();
        });

      } else if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        if (msg.type === 'audio_chunk') {
          // Usa clientContent.turns com inlineData ao invés de realtimeInput.
          // Isso garante que o modelo gere uma resposta (realtimeInput depende de VAD automático).
          const mimeType = msg.mimeType || 'audio/pcm;rate=16000';
          const base64Data = msg.data as string;

          // Validação: precisa ter dado real
          if (!base64Data || base64Data.length < 10) {
            console.warn('[RELAY] audio_chunk vazio ou muito pequeno, ignorando');
          } else {
            console.log(`[RELAY] Enviando audio ao Gemini: ${base64Data.length} chars base64, mimeType=${mimeType}`);
            const geminiFormat = {
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{
                    inlineData: {
                      mimeType,
                      data: base64Data
                    }
                  }]
                }],
                turnComplete: true
              }
            };
            geminiWs.send(JSON.stringify(geminiFormat));
          }
        } else if (msg.type === 'text_message') {
          const geminiFormat = {
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true
            }
          };
          geminiWs.send(JSON.stringify(geminiFormat));
        } else if (msg.type === 'turn_complete') {
          // No-op: turnComplete já é enviado junto com o audio_chunk acima
          console.log('[RELAY] turn_complete recebido (ignorado — já foi enviado com audio)');
        }
      }
    } catch (error) {
      console.error('[RELAY] Error parsing client message:', error);
    }
  });

  clientWs.on('close', () => {
    console.log(`[RELAY] Client connection closed`);
    cleanup();
  });

  clientWs.on('error', (err) => {
    console.error(`[RELAY] Client WS error:`, err);
    cleanup();
  });
};
