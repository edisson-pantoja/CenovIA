// ============================================================
// Tipos compartilhados — CenovIA
// Usados pelo backend (Node.js) e pelo mobile (Expo)
// ============================================================

// -----------------------------------------------------------
// Currículo / Matérias
// -----------------------------------------------------------

export type EducationLevel = 'fundamental' | 'medio' | 'superior';

export interface GradeOption {
  id: string;
  label: string; // ex: "1º Ano", "2ª Série"
  level: EducationLevel;
  order: number;
}

export interface SubjectOption {
  id: string;
  name: string;
  bnccCode?: string; // ex: "EF01LP01"
  level: EducationLevel;
  gradeId?: string; // null = disponível em todas as séries do nível
  isCustom: boolean;
}

// -----------------------------------------------------------
// Sessão de Estudo
// -----------------------------------------------------------

export interface StudyContext {
  level: EducationLevel;
  gradeId?: string;     // Fundamental/Médio
  gradeLabel: string;   // "1ª Série do Ensino Médio"
  course?: string;      // Superior: nome do curso
  subjectId?: string;
  subjectName: string;  // "Química Orgânica"
}

export interface StudySession {
  id: string;
  userId: string;
  context: StudyContext;
  startedAt: string;   // ISO 8601
  endedAt?: string;
  durationSeconds: number;
  minutesUsed: number;
}

export interface UserUsage {
  userId: string;
  month: string;        // "2026-08"
  minutesUsed: number;
  minutesLimit: number; // Free tier: 30 minutos/mês
  minutesRemaining: number;
}

// -----------------------------------------------------------
// Eventos do Quadro Verde
// -----------------------------------------------------------

export type BoardEventType =
  | 'text'
  | 'latex'
  | 'smiles'
  | 'svg_path'
  | 'clear'
  | 'highlight'
  | 'erase_element';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseBoardEvent {
  id: string;           // UUID do evento
  type: BoardEventType;
  timestampMs: number;  // Relativo ao início da sessão
}

export interface TextBoardEvent extends BaseBoardEvent {
  type: 'text';
  content: string;
  x: number;           // 0-1 (proporcional à largura do quadro)
  y: number;           // 0-1 (proporcional à altura do quadro)
  fontSize?: number;   // em unidades relativas
  color?: string;      // default: "#F5F5DC" (chalk white)
}

export interface LatexBoardEvent extends BaseBoardEvent {
  type: 'latex';
  formula: string;     // ex: "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
  x: number;
  y: number;
  scale?: number;
}

export interface SmilesBoardEvent extends BaseBoardEvent {
  type: 'smiles';
  molecule: string;    // ex: "C6H12O6" ou SMILES: "OC[C@H]1OC..."
  label?: string;
  x: number;
  y: number;
}

export interface SvgPathBoardEvent extends BaseBoardEvent {
  type: 'svg_path';
  path: string;        // SVG path data
  strokeColor?: string;
  strokeWidth?: number;
  durationMs?: number; // Duração da animação de escrita
}

export interface ClearBoardEvent extends BaseBoardEvent {
  type: 'clear';
}

export interface HighlightBoardEvent extends BaseBoardEvent {
  type: 'highlight';
  region: BoundingBox;
  color?: string;
}

export interface EraseElementBoardEvent extends BaseBoardEvent {
  type: 'erase_element';
  elementId: string; // ID do evento a ser apagado
}

export type BoardEvent =
  | TextBoardEvent
  | LatexBoardEvent
  | SmilesBoardEvent
  | SvgPathBoardEvent
  | ClearBoardEvent
  | HighlightBoardEvent
  | EraseElementBoardEvent;

// -----------------------------------------------------------
// Protocolo WebSocket (Client ↔ Backend Relay)
// -----------------------------------------------------------

// Mensagens Client → Server
export type ClientMessage =
  | { type: 'session_start'; context: StudyContext; token: string }
  | { type: 'audio_chunk'; data: string; mimeType: 'audio/pcm' }
  | { type: 'text_message'; text: string }
  | { type: 'session_end' };

// Mensagens Server → Client
export type ServerMessage =
  | { type: 'session_ready'; sessionId: string; usage: UserUsage }
  | { type: 'audio_chunk'; data: string; timestampMs: number }
  | { type: 'board_event'; event: BoardEvent }
  | { type: 'teacher_state'; state: TeacherState }
  | { type: 'usage_update'; usage: UserUsage }
  | { type: 'usage_limit_reached'; minutesLimit: number }
  | { type: 'error'; code: ErrorCode; message: string };

export type TeacherState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type ErrorCode =
  | 'AUTH_FAILED'
  | 'USAGE_LIMIT_REACHED'
  | 'GEMINI_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'INTERNAL_ERROR';

// -----------------------------------------------------------
// Cache Local de Sessão (SQLite / IndexedDB)
// -----------------------------------------------------------

export interface SessionChunk {
  sessionId: string;
  chunkIndex: number;
  timestampMs: number;
  audioBase64: string;
  boardEvents: BoardEvent[];
}

// -----------------------------------------------------------
// API REST — Currículo
// -----------------------------------------------------------

export interface CurriculumResponse {
  levels: {
    fundamental: {
      grades: GradeOption[];
      subjects: SubjectOption[];
    };
    medio: {
      grades: GradeOption[];
      subjects: SubjectOption[];
    };
    superior: {
      courseExamples: string[];
    };
  };
}
