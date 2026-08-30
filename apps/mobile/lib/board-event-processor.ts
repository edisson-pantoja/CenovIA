import { BoardEvent } from './gemini-live-client';

export class BoardEventProcessor {
  private events: BoardEvent[] = [];

  addEvent(event: BoardEvent) {
    this.events.push(event);
  }

  getEventsAt(timeMs: number): BoardEvent[] {
    // Retorna eventos que estão "ativos" naquele ms exato, simplificado para o exemplo
    return this.events.filter(e => e.timestampMs === timeMs);
  }

  getEventsUpTo(timeMs: number): BoardEvent[] {
    return this.events.filter(e => e.timestampMs <= timeMs);
  }
  
  clear() {
    this.events = [];
  }
}
