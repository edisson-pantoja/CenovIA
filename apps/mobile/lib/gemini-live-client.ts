/**
 * GeminiLiveClient — Cliente WebSocket para o relay backend do CenovIA
 *
 * Fluxo:
 *   1. connect() → abre WebSocket para o backend relay
 *   2. Envia { type: 'session_start', context, token }
 *   3. Recebe confirmação { type: 'session_ready' }
 *   4. sendAudioChunk() → envia PCM base64 capturado pelo microfone
 *   5. Callbacks disparam para: áudio da professora, eventos do quadro, estados
 *   6. disconnect() → fecha a sessão e o socket
 */

import { BACKEND_WS_URL } from './constants';
import type { BoardEvent, ClientMessage, ServerMessage, StudyContext, TeacherState, UserUsage } from '@cenovia/shared';

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private isIntentionalClose = false;

  // ── Callbacks públicos ─────────────────────────────────────────────────────

  onConnected: () => void = () => {};
  onSessionReady: (sessionId: string, usage: UserUsage) => void = () => {};
  onAudioChunk: (data: string, timestampMs: number) => void = () => {};
  onBoardEvent: (event: BoardEvent) => void = () => {};
  onTeacherStateChange: (state: TeacherState) => void = () => {};
  onUsageUpdate: (usage: UserUsage) => void = () => {};
  onUsageLimitReached: () => void = () => {};
  onError: (code: string, message: string) => void = () => {};
  onDisconnected: () => void = () => {};

  // ── Conexão ────────────────────────────────────────────────────────────────

  async connect(token: string, context: StudyContext): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isIntentionalClose = false;
      const wsUrl = `${BACKEND_WS_URL}/ws/relay`;

      console.log('[GEMINI-CLIENT] Conectando ao relay:', wsUrl);

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(new Error(`Falha ao criar WebSocket: ${err}`));
        return;
      }

      this.ws.onopen = () => {
        console.log('[GEMINI-CLIENT] WebSocket aberto, iniciando sessão...');
        this.reconnectAttempts = 0;
        this.onConnected();

        // Envia mensagem de início de sessão com token e contexto
        const startMsg: ClientMessage = {
          type: 'session_start',
          context,
          token,
        };
        this.ws!.send(JSON.stringify(startMsg));
        resolve();
      };

      this.ws.onmessage = (event) => {
        this._handleServerMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error('[GEMINI-CLIENT] Erro WebSocket:', err);
        this.onError('WS_ERROR', 'Erro de conexão com o servidor');
        reject(err);
      };

      this.ws.onclose = (event) => {
        console.log(`[GEMINI-CLIENT] Conexão fechada: code=${event.code} reason=${event.reason}`);
        this.onDisconnected();

        // Reconectar automaticamente em caso de queda inesperada
        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectAttempts * 2000;
          console.log(`[GEMINI-CLIENT] Reconectando em ${delay}ms (tentativa ${this.reconnectAttempts})...`);
          setTimeout(() => {
            this.connect(token, context).catch(console.error);
          }, delay);
        }
      };
    });
  }

  // ── Envio de dados ─────────────────────────────────────────────────────────

  /** Envia chunk de áudio PCM capturado do microfone (base64) */
  sendAudioChunk(base64Audio: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = { type: 'audio_chunk', data: base64Audio, mimeType: 'audio/pcm' };
    this.ws.send(JSON.stringify(msg));
  }

  /** Envia mensagem de texto (quando o aluno prefere digitar) */
  sendTextMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = { type: 'text_message', text };
    this.ws.send(JSON.stringify(msg));
  }

  /** Encerra a sessão e fecha o WebSocket de forma limpa */
  disconnect(): void {
    this.isIntentionalClose = true;
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        const msg: ClientMessage = { type: 'session_end' };
        this.ws.send(JSON.stringify(msg));
      }
      this.ws.close(1000, 'Sessão encerrada pelo aluno');
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ── Processamento de mensagens do servidor ─────────────────────────────────

  private _handleServerMessage(rawData: string): void {
    let msg: ServerMessage;

    try {
      msg = JSON.parse(rawData) as ServerMessage;
    } catch {
      console.warn('[GEMINI-CLIENT] Mensagem não-JSON recebida, ignorando');
      return;
    }

    switch (msg.type) {
      case 'session_ready':
        console.log('[GEMINI-CLIENT] Sessão pronta:', msg.sessionId);
        this.onSessionReady(msg.sessionId, msg.usage);
        this.onTeacherStateChange('idle');
        break;

      case 'audio_chunk':
        // Chunk de áudio da professora — repassa para o AudioManager
        this.onAudioChunk(msg.data, msg.timestampMs);
        this.onTeacherStateChange('speaking');
        break;

      case 'board_event':
        // Evento de desenho no quadro verde
        this.onBoardEvent(msg.event);
        break;

      case 'teacher_state':
        this.onTeacherStateChange(msg.state);
        break;

      case 'usage_update':
        this.onUsageUpdate(msg.usage);
        break;

      case 'usage_limit_reached':
        console.warn('[GEMINI-CLIENT] Limite de minutos atingido!');
        this.onUsageLimitReached();
        this.disconnect();
        break;

      case 'error':
        console.error(`[GEMINI-CLIENT] Erro do servidor: ${msg.code} — ${msg.message}`);
        this.onError(msg.code, msg.message);
        break;

      default:
        // Mensagens do Gemini repassadas pelo relay (ex: setupComplete, turnComplete)
        // Tratamos mudanças de estado baseadas em campos conhecidos
        const raw = msg as Record<string, unknown>;
        if (raw['setupComplete']) {
          console.log('[GEMINI-CLIENT] Setup Gemini concluído');
          this.onTeacherStateChange('idle');
        } else if (raw['serverContent']) {
          const content = raw['serverContent'] as Record<string, unknown>;
          if (content['turnComplete']) {
            // Professora terminou de falar
            this.onTeacherStateChange('idle');
          }
        }
        break;
    }
  }
}

// Singleton para uso em toda a app
export const geminiClient = new GeminiLiveClient();
