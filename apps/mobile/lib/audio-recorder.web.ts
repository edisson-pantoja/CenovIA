/**
 * WebAudioRecorder — Gravador de áudio para Web usando MediaRecorder nativo do browser.
 *
 * O expo-av não suporta gravação de forma confiável no browser.
 * Este módulo usa diretamente a API MediaRecorder do browser.
 *
 * O áudio é gravado como audio/webm;codecs=opus (suportado por Chrome/Edge/Firefox).
 */

export class WebAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  /** Retorna true se o browser suporta gravação de áudio */
  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  /** Inicia a gravação. Retorna false se o usuário negar permissão. */
  async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Tenta webm/opus (Chrome/Firefox), fallback para o default do browser
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.start();
      return true;
    } catch (err) {
      console.error('[WebAudioRecorder] Erro ao iniciar:', err);
      return false;
    }
  }

  /** Para a gravação e retorna o Blob de áudio com o mimeType correto */
  async stop(): Promise<{ blob: Blob; mimeType: string } | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        resolve({ blob, mimeType });
      };
      this.mediaRecorder!.stop();
    });
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

export const webAudioRecorder = new WebAudioRecorder();
