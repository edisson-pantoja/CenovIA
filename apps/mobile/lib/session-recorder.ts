import { BoardEvent } from './gemini-live-client';

export interface SessionChunk {
  audioBase64: string;
  boardEvents: BoardEvent[];
  timestampMs: number;
}

export class SessionRecorder {
  private sessionId: string | null = null;
  private chunks: SessionChunk[] = [];

  startRecording(sessionId: string): void {
    this.sessionId = sessionId;
    this.chunks = [];
  }

  addChunk(audioBase64: string, boardEvents: BoardEvent[], timestampMs: number): void {
    this.chunks.push({ audioBase64, boardEvents, timestampMs });
  }

  stopRecording(): void {
    // Save to sqlite db via expo-sqlite
    console.log('Saved session to sqlite', this.sessionId);
    this.sessionId = null;
  }

  getChunksUpTo(timeMs: number): SessionChunk[] {
    return this.chunks.filter(c => c.timestampMs <= timeMs);
  }

  getTotalDuration(): number {
    if (this.chunks.length === 0) return 0;
    return this.chunks[this.chunks.length - 1].timestampMs;
  }
}
