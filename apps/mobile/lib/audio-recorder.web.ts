/**
 * WebAudioRecorder — Gravador de áudio para Web
 * Captura o microfone e converte para PCM 16-bit 16kHz (Exigido pelo Gemini Live API)
 */

export class WebAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcmChunks: Int16Array[] = [];

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      (window.AudioContext || (window as any).webkitAudioContext) !== undefined
    );
  }

  async start(): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Initialize context with exactly 16000 Hz if supported (most modern browsers support this)
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use ScriptProcessorNode (deprecated but works everywhere without needing external worklet files)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.pcmChunks = [];
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.pcmChunks.push(pcm16);
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

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;

    // Concatena os chunks PCM
    const totalLength = this.pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const pcmData = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      pcmData.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];

    // O Gemini aceita áudio PCM puro (raw data, sem cabeçalho WAV) como base64
    // Então vamos apenas retornar os bytes puros
    const blob = new Blob([pcmData.buffer], { type: 'audio/pcm' });
    return { blob, mimeType: 'audio/pcm;rate=16000' };
  }
}

export const webAudioRecorder = new WebAudioRecorder();
