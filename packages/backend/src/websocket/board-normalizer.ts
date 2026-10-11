import crypto from 'crypto';
import type { BoardEvent } from '@cenovia/shared';

interface RawBoardElement {
  kind?: string;
  type?: string;
  content?: string;
  formula?: string;
  text?: string;
  molecule?: string;
  path?: string;
  color?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  scale?: number;
  [key: string]: any;
}

interface RawBoardArgs {
  clear?: boolean;
  elements?: RawBoardElement[];
  [key: string]: any;
}

function clamp(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    return Math.max(min, Math.min(max, val));
  }
  return fallback;
}

const COLOR_MAP: Record<string, string> = {
  white: '#F5F5DC',
  yellow: '#FFE066',
  pink: '#FF80BF',
  blue: '#80D0FF',
  green: '#70E090',
};

function resolveColor(rawColor?: string, defaultColor = '#F5F5DC'): string {
  if (!rawColor) return defaultColor;
  const lower = rawColor.toLowerCase();
  return COLOR_MAP[lower] || rawColor;
}

export function normalizeBoardCall(args: unknown, sessionStartMs: number): BoardEvent[] {
  const events: BoardEvent[] = [];
  const now = Date.now();
  const timestampMs = Math.max(0, now - (sessionStartMs || now));

  if (!args || typeof args !== 'object') {
    return events;
  }

  const rawArgs = args as RawBoardArgs;

  // 1. Tratamento de clear
  if (rawArgs.clear === true) {
    events.push({
      id: crypto.randomUUID(),
      type: 'clear',
      timestampMs,
    });
  }

  // 2. Extração de elementos (suporta formato novo { elements: [...] } e legado direto no objeto)
  let rawElements: RawBoardElement[] = [];

  if (Array.isArray(rawArgs.elements)) {
    rawElements = rawArgs.elements;
  } else if (Array.isArray(args)) {
    rawElements = args as RawBoardElement[];
  } else if (rawArgs.content || rawArgs.formula || rawArgs.kind || rawArgs.type) {
    // Retrocompatível: chamada direta com um único elemento
    rawElements = [rawArgs as RawBoardElement];
  }

  let currentYCascade = 0.12;

  for (const el of rawElements) {
    if (!el || typeof el !== 'object') continue;

    const kind = String(el.kind || el.type || '').trim().toLowerCase();
    const content = String(el.content || el.formula || el.text || el.molecule || el.path || '').trim();

    if (!content && kind !== 'clear') {
      continue;
    }

    const rawX = typeof el.x === 'number' ? el.x : undefined;
    const rawY = typeof el.y === 'number' ? el.y : undefined;

    const x = clamp(rawX, 0, 1, 0.08);
    const y = clamp(rawY, 0, 1, currentYCascade);

    // Incrementa cascata para o próximo elemento que não tiver y definido
    currentYCascade = Math.min(0.9, y + 0.08);

    const eventId = crypto.randomUUID();

    if (kind === 'title') {
      events.push({
        id: eventId,
        type: 'text',
        variant: 'title',
        content,
        color: resolveColor(el.color, '#FFE066'),
        x,
        y,
        fontSize: el.fontSize || 1.3,
        timestampMs,
      });
    } else if (kind === 'text') {
      events.push({
        id: eventId,
        type: 'text',
        variant: 'text',
        content,
        color: resolveColor(el.color, '#F5F5DC'),
        x,
        y,
        fontSize: el.fontSize,
        timestampMs,
      });
    } else if (kind === 'underline') {
      events.push({
        id: eventId,
        type: 'text',
        variant: 'underline',
        content,
        color: resolveColor(el.color, '#FFE066'),
        x,
        y,
        fontSize: el.fontSize,
        timestampMs,
      });
    } else if (kind === 'latex' || kind === 'math' || kind === 'formula') {
      events.push({
        id: eventId,
        type: 'latex',
        formula: content,
        x,
        y,
        scale: el.scale,
        timestampMs,
      });
    } else if (kind === 'note_box' || kind === 'notebox' || kind === 'box') {
      events.push({
        id: eventId,
        type: 'note_box',
        content,
        color: resolveColor(el.color, '#FF80BF'),
        x,
        y,
        timestampMs,
      });
    } else if (kind === 'smiles' || kind === 'molecule') {
      events.push({
        id: eventId,
        type: 'smiles',
        molecule: content,
        label: el.label,
        x,
        y,
        timestampMs,
      });
    } else if (kind === 'svg_path' || kind === 'path') {
      events.push({
        id: eventId,
        type: 'svg_path',
        path: content,
        strokeColor: resolveColor(el.strokeColor || el.color, '#F5F5DC'),
        strokeWidth: el.strokeWidth,
        durationMs: el.durationMs,
        timestampMs,
      });
    } else {
      // Kind desconhecido: heurística de tolerância
      // Se tiver símbolos matemáticos / LaTeX: vira latex
      const isMath = /[\^=_\\/]/.test(content) || content.includes('\\frac') || content.includes('\\sqrt');
      if (isMath) {
        events.push({
          id: eventId,
          type: 'latex',
          formula: content,
          x,
          y,
          scale: el.scale,
          timestampMs,
        });
      } else {
        events.push({
          id: eventId,
          type: 'text',
          variant: 'text',
          content,
          color: resolveColor(el.color, '#F5F5DC'),
          x,
          y,
          timestampMs,
        });
      }
    }
  }

  return events;
}
