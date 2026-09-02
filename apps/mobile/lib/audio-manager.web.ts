/**
 * AudioManager (Web override) — usa Web Audio API para gravar e reproduzir áudio.
 *
 * No browser, o expo-av não consegue tocar raw PCM diretamente.
 * Este arquivo substitui audio-manager.ts no build web (extensão .web.ts).
 *
 * Entrada:  PCM 16-bit, 16kHz, mono (para o Gemini)
 * Saída:    PCM 16-bit, 24kHz, mono (do Gemini) → tocado via AudioContext
 */

// Na versão web não usamos expo-av (nativo). Definimos o tipo localmente para
// manter compatibilidade com a interface genérica de AudioManager.
type AVPlaybackStatus = { isLoaded: boolean };

type AudioChunkCallback = (base64Chunk: string) => void;

/** Converte base64 de raw PCM Int16 para um AudioBuffer tocável */
function pcmBase64ToAudioBuffer(
  base64: string,
  sampleRate: number,
  ctx: AudioContext,
): AudioBuffer {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  // Raw PCM é Int16 (2 bytes por sample)
  const samples = bytes.length / 2;
  const buffer = ctx.createBuffer(1, samples, sampleRate);
  const channelData = buffer.getChannelData(0);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i++) {
    // Little-endian Int16 → Float32 [-1, 1]
    channelData[i] = view.getInt16(i * 2, true) / 32768.0;
  }
  return buffer;
}

export class AudioManager {
  // Gravação (input) — delegada ao WebAudioRecorder no classroom.tsx
  private recording: null = null;
  private sound: null = null;

  // Output queue — usamos AudioContext para tocar chunks sequencialmente
  private playbackCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;

  // Buffer de replay
  private replayBuffer: { timestampMs: number; uri: string }[] = [];

  onAudioChunk: AudioChunkCallback = () => {};
  onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null;

  private getPlaybackContext(): AudioContext {
    if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackCtx = new Ctx();
      this.nextPlayTime = 0;
    }
    return this.playbackCtx;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  // startRecording / stopRecording are handled by WebAudioRecorder in classroom.tsx for web
  async startRecording(): Promise<void> {}
  async stopRecording(): Promise<string | null> { return null; }

  private activeSources: AudioBufferSourceNode[] = [];

  /**
   * Toca um chunk de áudio PCM base64 vindo do Gemini.
   * Os chunks são enfileirados para reprodução contínua sem falhas (gapless).
   */
  async playAudioChunk(base64Pcm: string, timestampMs: number, mimeType?: string): Promise<void> {
    try {
      const ctx = this.getPlaybackContext();

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Default para 24000 (padrão do Gemini 2.5), mas tenta extrair do mimeType (ex: "audio/pcm;rate=16000")
      let rate = 24000;
      if (mimeType) {
        const match = mimeType.match(/rate=(\d+)/);
        if (match && match[1]) {
          rate = parseInt(match[1], 10);
        }
      }

      const audioBuffer = pcmBase64ToAudioBuffer(base64Pcm, rate, ctx);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(ctx.currentTime, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;
      
      this.activeSources.push(source);
      source.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== source);
      };

      this.replayBuffer.push({ timestampMs, uri: '' });
    } catch (err) {
      console.error('[AUDIO-WEB] Erro ao tocar chunk:', err);
    }
  }

  /** Interrompe a reprodução atual limpando a fila */
  clearPlayback(): void {
    for (const source of this.activeSources) {
      try { source.stop(); } catch (e) {}
    }
    this.activeSources = [];
    this.nextPlayTime = 0;
  }

  async pausePlayback(): Promise<void> {
    await this.playbackCtx?.suspend();
  }

  async resumePlayback(): Promise<void> {
    await this.playbackCtx?.resume();
  }

  async seekPlayback(_timeMs: number): Promise<void> {}

  getReplayChunkAt(_timeMs: number): string | null { return null; }

  getTotalBufferedDuration(): number {
    return this.replayBuffer.length > 0
      ? this.replayBuffer[this.replayBuffer.length - 1].timestampMs
      : 0;
  }

  clearBuffer(): void {
    this.replayBuffer = [];
    this.nextPlayTime = 0;
  }

  async cleanup(): Promise<void> {
    this.clearBuffer();
    if (this.playbackCtx && this.playbackCtx.state !== 'closed') {
      await this.playbackCtx.close();
      this.playbackCtx = null;
    }
    console.log('[AUDIO-WEB] Recursos liberados');
  }
}

export const audioManager = new AudioManager();
