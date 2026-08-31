/**
 * WebAudioRecorder — Gravador de áudio para Web
 *
 * Captura microfone na taxa nativa do browser (normalmente 48000Hz),
 * reamostra para 16000Hz com interpolação linear, e converte para PCM 16-bit
 * (formato exigido pelo Gemini Live API).
 *
 * O Chrome geralmente ignora AudioContext({ sampleRate: 16000 }) — por isso
 * capturamos na taxa nativa e fazemos o downsample em JS.
 */

/** Reamostra Float32Array de inputRate para outputRate (interpolação linear) */
function resample(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.ceil(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const srcFloor = Math.floor(srcIdx);
    const frac = srcIdx - srcFloor;
    if (srcFloor + 1 < input.length) {
      output[i] = input[srcFloor] * (1 - frac) + input[srcFloor + 1] * frac;
    } else {
      output[i] = input[srcFloor] ?? 0;
    }
  }
  return output;
}

/** Converte Float32 [-1, 1] para Int16 PCM */
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
  private nativeSampleRate = 48000;

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
      // Não forçamos sampleRate — deixamos o browser usar a taxa nativa
      // (tipicamente 48000 no Chrome) e reamostramos depois
      this.audioContext = new Ctx();
      this.nativeSampleRate = this.audioContext.sampleRate;
      console.log(`[WebAudioRecorder] Taxa nativa: ${this.nativeSampleRate}Hz`);

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Buffer de 4096 amostras para latência razoável
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.pcmChunks = [];

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Reamostra de nativeSampleRate → 16000
        const resampled = resample(inputData, this.nativeSampleRate, 16000);
        this.pcmChunks.push(float32ToInt16(resampled));
      };

      source.connect(this.processor);
      // Conectar ao destination é necessário para o onaudioprocess disparar
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

    // Concatena todos os chunks PCM em um único buffer
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

    // PCM puro (sem cabeçalho) — é o que o Gemini Live espera
    const blob = new Blob([pcm.buffer], { type: 'audio/pcm' });
    return { blob, mimeType: 'audio/pcm;rate=16000' };
  }
}

export const webAudioRecorder = new WebAudioRecorder();
