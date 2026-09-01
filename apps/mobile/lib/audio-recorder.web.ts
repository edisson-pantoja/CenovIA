/**
 * WebAudioRecorder — Gravador de áudio para Web com streaming em tempo real
 *
 * Cada chunk de 4096 amostras PCM 16-bit é convertido para base64 e transmitido
 * imediatamente via callback `onChunk` — sem acumular tudo para o final.
 *
 * Isso é compatível com o modelo de realtimeInput do Gemini Live API, que usa
 * VAD (Voice Activity Detection) para detectar automaticamente o fim da fala.
 */

/** Converte Float32 [-1, 1] para Int16 PCM */
function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/** Converte Int16Array para base64 de forma síncrona e eficiente */
function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB por vez para não estourar a pilha
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export class WebAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;

  /** Chamado a cada ~256ms com um chunk de áudio PCM base64 16kHz */
  onChunk?: (base64: string, mimeType: string) => void;

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      !!(window.AudioContext || (window as any).webkitAudioContext)
    );
  }

  async start(): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new Ctx({ sampleRate: 16000 });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log(`[WebAudioRecorder] Iniciado: ${this.audioContext.sampleRate}Hz, state=${this.audioContext.state}`);

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 4096 amostras @ 16kHz = ~256ms por chunk — bom para streaming
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToInt16(inputData);

        // Silencia o output para não criar eco nos alto-falantes
        const outputData = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < outputData.length; i++) outputData[i] = 0;

        // Envia o chunk imediatamente via streaming (não acumula)
        if (this.onChunk) {
          const base64 = int16ToBase64(pcm16);
          this.onChunk(base64, 'audio/pcm;rate=16000');
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      return true;
    } catch (err) {
      console.error('[WebAudioRecorder] Erro ao iniciar:', err);
      return false;
    }
  }

  async stop(): Promise<void> {
    this.onChunk = undefined;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;

    console.log('[WebAudioRecorder] Gravação encerrada');
  }
}

export const webAudioRecorder = new WebAudioRecorder();
