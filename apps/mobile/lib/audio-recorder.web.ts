/**
 * WebAudioRecorder — Gravador de áudio para Web
 *
 * Captura microfone e usa o AudioContext do browser para reamostrar
 * internamente para 16000Hz com alta qualidade. Converte para PCM 16-bit
 * (formato exigido pelo Gemini Live API).
 */

/** Converte Float32 [-1, 1] para Int16 PCM (Little Endian nativo) */
function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export class WebAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcmChunks: Int16Array[] = [];

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
      // Solicita 16kHz nativamente. O Chrome usa um resampler de alta qualidade internamente.
      this.audioContext = new Ctx({ sampleRate: 16000 });
      console.log(`[WebAudioRecorder] Taxa real configurada: ${this.audioContext.sampleRate}Hz`);

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Buffer de 4096 amostras
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.pcmChunks = [];

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // O input já está em 16kHz pelo AudioContext
        this.pcmChunks.push(float32ToInt16(inputData));
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      return true;
    } catch (err) {
      console.error('[WebAudioRecorder] Erro ao iniciar:', err);
      return false;
    }
  }

  async stop(): Promise<{ blob: Blob; mimeType: string } | null> {
    if (!this.processor || !this.audioContext) return null;

    this.processor.disconnect();
    this.processor = null;

    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;

    if (this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;

    const totalSamples = this.pcmChunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];

    console.log(
      `[WebAudioRecorder] Gravado: ${totalSamples} amostras @ 16kHz (${(totalSamples / 16000).toFixed(2)}s)`,
    );

    const blob = new Blob([pcm.buffer], { type: 'audio/pcm' });
    return { blob, mimeType: 'audio/pcm;rate=16000' };
  }
}

export const webAudioRecorder = new WebAudioRecorder();
