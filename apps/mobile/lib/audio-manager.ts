/**
 * AudioManager — Gerenciador de captura e reprodução de áudio do CenovIA
 *
 * Responsabilidades:
 *  - Captura áudio do microfone via expo-av e emite chunks PCM base64
 *  - Toca o áudio PCM recebido da professora (Gemini Live)
 *  - Gerencia um buffer local para replay de sessão
 */

import { Audio, AVPlaybackStatus } from 'expo-av';

/** Callback invocado a cada chunk de áudio capturado do microfone */
type AudioChunkCallback = (base64Chunk: string) => void;

export class AudioManager {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;

  // Buffer de áudio para replay: array de URIs temporárias em ordem
  private replayBuffer: { timestampMs: number; uri: string }[] = [];
  private sessionStartMs: number = 0;

  // Callback para envio de chunks ao GeminiLiveClient
  onAudioChunk: AudioChunkCallback = () => {};
  onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null;

  // ── Gravação (microfone → Gemini) ─────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  async startRecording(): Promise<void> {
    try {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Permissão de microfone negada');
      }

      // Configura o modo de áudio para gravação e playback simultâneos
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Configuração para PCM 16kHz (formato exigido pelo Gemini Live)
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRateStrategy: Audio.IOSBitRateStrategy.CONSTANT,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm;codecs=opus',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      this.recording = recording;

      console.log('[AUDIO] Gravação iniciada');
    } catch (err) {
      console.error('[AUDIO] Erro ao iniciar gravação:', err);
      throw err;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      console.log('[AUDIO] Gravação parada, URI:', uri);
      return uri;
    } catch (err) {
      console.error('[AUDIO] Erro ao parar gravação:', err);
      this.recording = null;
      return null;
    }
  }

  // ── Playback (áudio da professora) ─────────────────────────────────────────

  /**
   * Toca um chunk de áudio PCM base64 recebido do Gemini Live.
   * Os chunks chegam sequencialmente e devem ser enfileirados para reprodução contínua.
   */
  async playAudioChunk(base64Pcm: string, timestampMs: number): Promise<void> {
    try {
      // Converte base64 para URI de dados para o expo-av
      const dataUri = `data:audio/wav;base64,${base64Pcm}`;

      // Salva no buffer para replay
      this.replayBuffer.push({ timestampMs, uri: dataUri });

      // Aguarda o som anterior terminar antes de tocar o próximo (fila simples)
      if (this.sound) {
        const status = await this.sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          // Som ainda tocando — enfileira (simplificação para MVP)
          return;
        }
        await this.sound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { shouldPlay: true },
        this.onPlaybackStatusUpdate ?? undefined,
      );
      this.sound = sound;
    } catch (err) {
      console.error('[AUDIO] Erro ao tocar chunk:', err);
    }
  }

  /** Interrompe a reprodução atual */
  async clearPlayback(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (e) {}
      this.sound = null;
    }
  }

  // ── Replay (controles do player) ──────────────────────────────────────────

  async pausePlayback(): Promise<void> {
    if (this.sound) {
      await this.sound.pauseAsync();
    }
  }

  async resumePlayback(): Promise<void> {
    if (this.sound) {
      await this.sound.playAsync();
    }
  }

  async seekPlayback(timeMs: number): Promise<void> {
    if (this.sound) {
      await this.sound.setPositionAsync(timeMs);
    }
  }

  /** Retorna o chunk de replay mais próximo do timestamp dado */
  getReplayChunkAt(timeMs: number): string | null {
    const chunk = this.replayBuffer.reduce(
      (closest, c) => {
        const diff = Math.abs(c.timestampMs - timeMs);
        return diff < closest.diff ? { chunk: c, diff } : closest;
      },
      { chunk: null as (typeof this.replayBuffer)[0] | null, diff: Infinity },
    );
    return chunk.chunk?.uri ?? null;
  }

  getTotalBufferedDuration(): number {
    if (this.replayBuffer.length === 0) return 0;
    return this.replayBuffer[this.replayBuffer.length - 1].timestampMs;
  }

  clearBuffer(): void {
    this.replayBuffer = [];
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async cleanup(): Promise<void> {
    if (this.recording) {
      await this.stopRecording();
    }
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }
    this.clearBuffer();
    console.log('[AUDIO] Recursos liberados');
  }
}

// Singleton
export const audioManager = new AudioManager();
