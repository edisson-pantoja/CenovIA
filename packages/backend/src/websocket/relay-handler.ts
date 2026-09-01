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

        geminiWs.on('open', () => {
          console.log(`[RELAY] Connected to Gemini for user ${userId}`);
          
          const systemInstruction = `Você é CenovIA, uma professora particular afetuosa, paciente e muito didática de ${context?.subjectName || 'várias matérias'} para ${context?.gradeLabel || 'o aluno'}. 
Responda SEMPRE em português do Brasil, com linguagem clara e adequada para o nível do aluno.
Quando explicar algo que precisa de visualização (fórmulas, diagramas, estruturas), use a função draw_board.
Se o aluno interromper você, pare de falar imediatamente e escute.
Seja encorajadora e positiva. Celebre quando o aluno acertar.`;

          const setupMessage = {
            setup: {
              model: "models/gemini-2.0-flash-live-preview-04-09",
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

        geminiWs.on('message', (geminiData, geminiIsBinary) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            if (geminiIsBinary) {
               clientWs.send(geminiData, { binary: true });
            } else {
               const geminiMsgStr = geminiData.toString();
               try {
                 const geminiJson = JSON.parse(geminiMsgStr);
                 
                 // Intercept tool calls (board events) and audio
                 if (geminiJson?.serverContent?.modelTurn?.parts) {
                   const parts = geminiJson.serverContent.modelTurn.parts;
                   for (const part of parts) {
                     if (part.functionCall && part.functionCall.name === 'draw_board') {
                       clientWs.send(JSON.stringify({
                         type: 'board_event',
                         event: part.functionCall.args
                       }));
                     } else if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                       clientWs.send(JSON.stringify({
                         type: 'audio_chunk',
                         data: part.inlineData.data,
                         timestampMs: Date.now()
                       }));
                     }
                   }
                 }
                 
                 clientWs.send(geminiMsgStr);
               } catch (e) {
                 clientWs.send(geminiMsgStr);
               }
            }
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
          const geminiMsg = {
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: msg.data
              }]
            }
          };
          geminiWs.send(JSON.stringify(geminiMsg));
        } else if (msg.type === 'text_message') {
          const geminiMsg = {
            clientContent: {
              turns: [{
                role: "user",
                parts: [{ text: msg.text }]
              }],
              turnComplete: true
            }
          };
          geminiWs.send(JSON.stringify(geminiMsg));
        } else if (msg.type === 'session_end') {
          cleanup();
        } else {
          geminiWs.send(messageStr);
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
