/**
 * ChalkBoardWrapper.web.tsx — Quadro verde interativo de alta fidelidade do CenovIA (Web)
 *
 * Reproduz fielmente a estética visual da Profa. Ana:
 * - Slate chalkboard verde escuro com textura e moldura realista
 * - Barra de ferramentas lateral (Caneta, Giz selecionado, Borracha, Texto, Formas)
 * - Títulos destacados em giz amarelo com sublinhado ondulado
 * - Fórmulas matemáticas perfeitas renderizadas via KaTeX
 * - Caixa "Lembre-se:" com borda rosa arredondada e bullets de giz
 * - Animação de escrita progressiva de giz (chalk reveal)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import type { BoardEvent, NoteBoxBoardEvent, TextBoardEvent, LatexBoardEvent, SvgPathBoardEvent } from '@cenovia/shared';

interface Props {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

// Paleta de cores de giz do CenovIA (conforme mockup)
const CHALK_COLORS: Record<string, string> = {
  white: '#F5F5DC',
  yellow: '#F6E27A',
  pink: '#F4A6C0',
  blue: '#9FD3F7',
  green: '#A2E8B8',
};

function resolveChalkColor(rawColor?: string, fallback = '#F5F5DC'): string {
  if (!rawColor) return fallback;
  const lower = rawColor.toLowerCase();
  return CHALK_COLORS[lower] || rawColor;
}

// Renderizador seguro de fórmulas KaTeX
function renderLatexToHtml(formula: string, displayMode = false): string {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      displayMode,
    });
  } catch (err) {
    return `<span class="katex-fallback">${formula}</span>`;
  }
}

// ── Escrita lenta: cada elemento é "escrito" em sequência, com uma mão segurando o giz ──

interface Schedule {
  delay: number; // ms até começar a escrever
  dur: number;   // ms que leva para escrever
}

const MS_PER_CHAR = 75;

function estimateWriteDuration(event: BoardEvent): number {
  let chars = 20;
  if (event.type === 'text') chars = (event as TextBoardEvent).content.length;
  else if (event.type === 'latex') chars = (event as LatexBoardEvent).formula.length;
  else if (event.type === 'note_box') chars = (event as NoteBoxBoardEvent).content.length;
  else if (event.type === 'svg_path') return 2500;
  return Math.min(8000, Math.max(1100, chars * MS_PER_CHAR));
}

const ChalkHand = () => (
  <svg className="chalk-hand" width="46" height="58" viewBox="0 0 46 58" aria-hidden="true">
    {/* giz */}
    <rect x="4" y="2" width="7" height="20" rx="2" fill="#fffdf0" transform="rotate(-28 8 12)" />
    {/* dedos / mão */}
    <path
      d="M12 16c3-3 8-3 11 0l9 8c3 3 3 8 0 12l-6 8c-2 3-6 4-9 2l-8-6c-3-2-4-6-2-9l5-7z"
      fill="#e8b894"
      stroke="#b8845f"
      strokeWidth="1.2"
    />
    <path d="M16 22l7 4M15 28l8 3" stroke="#b8845f" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    {/* manga */}
    <path d="M20 44l16 10c3 2 7 1 8-2l1-5-17-10z" fill="#334155" />
  </svg>
);

interface ChalkItemProps {
  schedule: Schedule;
  style: React.CSSProperties;
  children: React.ReactNode;
}

/** Revela o conteúdo da esquerda para a direita enquanto uma mão com giz acompanha o traço */
function ChalkItem({ schedule, children }: ChalkItemProps) {
  const timing = `${schedule.dur}ms linear ${schedule.delay}ms both`;
  const handTiming = `${schedule.dur}ms linear ${schedule.delay}ms forwards`;
  return (
    <div className="chalk-element">
      <div className="chalk-reveal" style={{ animation: `chalkWriteReveal ${timing}` }}>
        {children}
      </div>
      <div className="chalk-hand-track" style={{ animation: `chalkHandMove ${handTiming}` }}>
        <ChalkHand />
      </div>
    </div>
  );
}

export default function ChalkBoardWrapper({ events = [], replayTimeMs }: Props) {
  const scheduleRef = useRef<Map<string, Schedule>>(new Map());
  const queueEndRef = useRef(0);
  const lastClearSeenRef = useRef(-1);
  const [selectedTool, setSelectedTool] = useState<'pen' | 'chalk' | 'eraser' | 'text' | 'shapes'>('chalk');
  const [isClearing, setIsClearing] = useState(false);

  // Injeta a folha de estilo do KaTeX e fontes caso não estejam presentes
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('katex-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'katex-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }
  }, []);

  // Filtra eventos para replay ou ao vivo
  const visibleEvents = useMemo(() => {
    return replayTimeMs !== undefined
      ? events.filter((e) => e.timestampMs <= replayTimeMs)
      : events;
  }, [events, replayTimeMs]);

  // Identifica o último clear
  const lastClearIndex = useMemo(() => {
    return visibleEvents.reduceRight(
      (acc, e, idx) => (acc === -1 && e.type === 'clear' ? idx : acc),
      -1,
    );
  }, [visibleEvents]);

  const renderableEvents = useMemo(() => {
    return lastClearIndex >= 0
      ? visibleEvents.slice(lastClearIndex + 1)
      : visibleEvents;
  }, [visibleEvents, lastClearIndex]);

  // Transição suave ao limpar
  useEffect(() => {
    if (lastClearIndex >= 0) {
      setIsClearing(true);
      const timer = setTimeout(() => setIsClearing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastClearIndex]);

  // Agenda a escrita sequencial (um elemento por vez; novo clear zera a fila)
  if (lastClearSeenRef.current !== lastClearIndex) {
    lastClearSeenRef.current = lastClearIndex;
    queueEndRef.current = 0;
  }
  const getSchedule = (event: BoardEvent): Schedule => {
    const known = scheduleRef.current.get(event.id);
    if (known) return known;
    let sched: Schedule;
    if (replayTimeMs !== undefined) {
      sched = { delay: 0, dur: 250 };
    } else {
      const now = Date.now();
      const start = Math.max(now, queueEndRef.current);
      const dur = estimateWriteDuration(event);
      sched = { delay: start - now, dur };
      queueEndRef.current = start + dur;
    }
    scheduleRef.current.set(event.id, sched);
    return sched;
  };

  return (
    <div className="cenovia-chalkboard-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

        .cenovia-chalkboard-root {
          display: flex;
          flex-direction: row;
          width: 100%;
          height: 100%;
          background-color: #0b1411;
          position: relative;
          user-select: none;
          overflow: hidden;
          box-sizing: border-box;
          font-family: 'Caveat', cursive, sans-serif;
        }

        /* ── Barra de Ferramentas Lateral (Esquerda) ── */
        .chalk-toolbar {
          width: 76px;
          background: #0f1814;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
          gap: 16px;
          z-index: 10;
        }

        .chalk-tool-btn {
          width: 54px;
          height: 56px;
          border-radius: 12px;
          background: transparent;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 500;
        }

        .chalk-tool-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.05);
        }

        .chalk-tool-btn.active {
          color: #ffffff;
          background: #059669;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);
        }

        .chalk-tool-icon {
          width: 22px;
          height: 22px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        /* ── Área Principal do Quadro Slate ── */
        .chalk-slate-container {
          flex: 1;
          height: 100%;
          padding: 10px 14px 14px 10px;
          display: flex;
          box-sizing: border-box;
        }

        .chalk-slate {
          flex: 1;
          height: 100%;
          position: relative;
          background: radial-gradient(circle at 45% 40%, #153e2f 0%, #0d2a20 60%, #081d15 100%);
          border: 8px solid #1a2520;
          border-radius: 18px;
          box-shadow: 
            inset 0 0 70px rgba(0, 0, 0, 0.75),
            0 10px 30px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          transition: opacity 0.3s ease;
        }

        .chalk-slate.clearing {
          opacity: 0.15;
        }

        /* Textura realista de pó de giz e grão de ardósia */
        .chalk-dust-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
            radial-gradient(rgba(246, 226, 122, 0.015) 1px, transparent 1px);
          background-size: 28px 28px, 44px 44px;
          background-position: 0 0, 14px 14px;
          pointer-events: none;
          z-index: 1;
        }

        /* Animação de escrita progressiva em giz */
        @keyframes chalkWriteReveal {
          0% {
            opacity: 0;
            clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
            transform: translateY(2px);
          }
          100% {
            opacity: 1;
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
            transform: translateY(0);
          }
        }

        .chalk-element {
          position: relative;
          z-index: 2;
          pointer-events: none;
          width: calc(50% - 13px);
          box-sizing: border-box;
        }

        /* Fluxo automático: os elementos entram em ordem de leitura e nunca se sobrepõem */
        .chalk-flow {
          position: absolute;
          inset: 14px 22px;
          display: flex;
          flex-direction: column;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: 12px 26px;
          overflow: hidden;
          z-index: 2;
        }

        .chalk-note-box { max-width: 100%; box-sizing: border-box; min-width: 0; }

        .chalk-reveal {
          display: inline-block;
        }

        /* Mão com giz: acompanha a borda direita do texto sendo revelado */
        .chalk-hand-track {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0;
          opacity: 0;
          pointer-events: none;
        }

        .chalk-hand {
          position: absolute;
          left: 100%;
          top: 55%;
          transform: translate(-6px, -2px);
          filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5));
          animation: chalkHandWiggle 380ms ease-in-out infinite;
        }

        @keyframes chalkHandMove {
          0%   { width: 0; opacity: 1; }
          97%  { opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }

        @keyframes chalkHandWiggle {
          0%, 100% { rotate: -4deg; }
          50%      { rotate: 5deg; }
        }

        /* ── Estilos de Texto e Giz ── */
        .chalk-text-item {
          color: #F5F5DC;
          font-size: clamp(22px, 2.4vw, 30px);
          line-height: 1.25;
          text-shadow: 
            0 0 1px rgba(255, 255, 255, 0.7),
            0 0 2px rgba(255, 255, 255, 0.3);
          letter-spacing: 0.5px;
          display: inline-block;
        }

        .chalk-title-item {
          color: #F6E27A;
          font-size: clamp(34px, 3.8vw, 48px);
          font-weight: 700;
          text-shadow: 
            0 0 2px rgba(246, 226, 122, 0.6),
            0 0 6px rgba(246, 226, 122, 0.25);
          display: inline-block;
          margin-bottom: 4px;
        }

        /* Sublinhado ondulado artesanal */
        .chalk-wavy-underline {
          display: block;
          width: 100%;
          height: 10px;
          margin-top: -2px;
        }

        /* ── Fórmulas KaTeX ── */
        .chalk-latex-item {
          color: #F5F5DC;
          font-size: clamp(22px, 2.4vw, 32px);
          filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.65));
          display: inline-block;
        }

        .chalk-latex-item .katex {
          font-size: 1.05em;
          color: #F5F5DC !important;
        }

        .chalk-latex-item .katex-display {
          margin: 0 !important;
        }

        /* ── Caixa "Lembre-se:" (Note Box) ── */
        .chalk-note-box {
          border: 2px solid #F4A6C0;
          border-radius: 18px;
          background: rgba(244, 166, 192, 0.05);
          box-shadow: 
            0 0 14px rgba(244, 166, 192, 0.15),
            inset 0 0 14px rgba(244, 166, 192, 0.05);
          padding: 14px 20px;
          min-width: 260px;
          max-width: 440px;
          color: #F4A6C0;
        }

        .chalk-note-box-title {
          font-size: clamp(24px, 2.6vw, 32px);
          font-weight: 700;
          margin-bottom: 8px;
          display: inline-block;
          border-bottom: 2px solid #F4A6C0;
          padding-bottom: 2px;
          text-shadow: 0 0 2px rgba(244, 166, 192, 0.6);
        }

        .chalk-note-box-lines {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .chalk-note-box-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: clamp(19px, 2vw, 25px);
          line-height: 1.25;
          color: #FCE7F3;
        }

        .chalk-bullet-dot {
          color: #F4A6C0;
          font-size: 18px;
          line-height: 1;
        }

        /* SVG Paths geométricos (como o triângulo retângulo) */
        .chalk-svg-path {
          filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.6));
        }

        /* Marca d'água discreta quando o quadro está vazio */
        .chalk-empty-watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: rgba(255, 255, 255, 0.12);
          pointer-events: none;
          font-weight: 600;
          letter-spacing: 1px;
        }
      `}</style>

      {/* ── Barra de Ferramentas Lateral (Estilo Mockup) ── */}
      <aside className="chalk-toolbar" aria-label="Ferramentas do quadro">
        <button
          className={`chalk-tool-btn ${selectedTool === 'pen' ? 'active' : ''}`}
          onClick={() => setSelectedTool('pen')}
          title="Caneta"
        >
          <svg className="chalk-tool-icon" viewBox="0 0 24 24">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <span>Caneta</span>
        </button>

        <button
          className={`chalk-tool-btn ${selectedTool === 'chalk' ? 'active' : ''}`}
          onClick={() => setSelectedTool('chalk')}
          title="Giz"
        >
          <svg className="chalk-tool-icon" viewBox="0 0 24 24">
            <path d="M15.5 3.5l5 5L7 22H2v-5L15.5 3.5z" />
            <path d="M14 5l5 5" />
          </svg>
          <span>Giz</span>
        </button>

        <button
          className={`chalk-tool-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
          onClick={() => setSelectedTool('eraser')}
          title="Borracha"
        >
          <svg className="chalk-tool-icon" viewBox="0 0 24 24">
            <path d="M20 20H7L3 16c-1-1-1-2.5 0-3.5l10-10c1-1 2.5-1 3.5 0l4 4c1 1 1 2.5 0 3.5L11 20" />
            <path d="M18 8l-4-4" />
          </svg>
          <span>Borracha</span>
        </button>

        <button
          className={`chalk-tool-btn ${selectedTool === 'text' ? 'active' : ''}`}
          onClick={() => setSelectedTool('text')}
          title="Texto"
        >
          <svg className="chalk-tool-icon" viewBox="0 0 24 24">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
          <span>Texto</span>
        </button>

        <button
          className={`chalk-tool-btn ${selectedTool === 'shapes' ? 'active' : ''}`}
          onClick={() => setSelectedTool('shapes')}
          title="Formas"
        >
          <svg className="chalk-tool-icon" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="12" cy="12" r="5" />
          </svg>
          <span>Formas</span>
        </button>
      </aside>

      {/* ── Tela Slate do Quadro Verde ── */}
      <main className="chalk-slate-container">
        <div className={`chalk-slate ${isClearing ? 'clearing' : ''}`}>
          <div className="chalk-dust-overlay" />

          {/* Renderização dinâmica dos elementos recebidos do Gemini */}
          <div className="chalk-flow">
          {renderableEvents.map((event) => {
            const rawX = 'x' in event ? (event as any).x : 0.08;
            const rawY = 'y' in event ? (event as any).y : 0.12;
            const posX = `${(rawX ?? 0.08) * 100}%`;
            const posY = `${(rawY ?? 0.12) * 100}%`;

            if (event.type === 'text') {
              const textEvent = event as TextBoardEvent;
              const isTitle = textEvent.variant === 'title';
              const color = resolveChalkColor(textEvent.color, isTitle ? '#F6E27A' : '#F5F5DC');

              return (
                <ChalkItem
                  key={event.id}
                  schedule={getSchedule(event)}
                  style={{ left: posX, top: posY }}
                >
                  {isTitle ? (
                    <div>
                      <span className="chalk-title-item" style={{ color }}>
                        {textEvent.content}
                      </span>
                      <svg className="chalk-wavy-underline" viewBox="0 0 100 8" preserveAspectRatio="none">
                        <path
                          d="M0,4 Q25,8 50,4 T100,4"
                          stroke={color}
                          strokeWidth="2.5"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div>
                      <span
                        className="chalk-text-item"
                        style={{
                          color,
                          fontSize: textEvent.fontSize ? `${textEvent.fontSize * 24}px` : undefined,
                        }}
                      >
                        {textEvent.content}
                      </span>
                      {textEvent.variant === 'underline' && (
                        <svg className="chalk-wavy-underline" viewBox="0 0 100 8" preserveAspectRatio="none">
                          <path
                            d="M0,4 Q25,7 50,4 T100,4"
                            stroke={color}
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                  )}
                </ChalkItem>
              );
            }

            if (event.type === 'latex') {
              const latexEvent = event as LatexBoardEvent;
              const html = renderLatexToHtml(latexEvent.formula, true);

              return (
                <ChalkItem
                  key={event.id}
                  schedule={getSchedule(event)}
                  style={{
                    left: posX,
                    top: posY,
                    transform: 'translateY(-30%)',
                  }}
                >
                  <div
                    className="chalk-latex-item"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </ChalkItem>
              );
            }

            if (event.type === 'note_box') {
              const noteBox = event as NoteBoxBoardEvent;
              const boxColor = resolveChalkColor(noteBox.color, '#F4A6C0');
              const rawLines = noteBox.content.split('\n').filter(Boolean);

              // Remove título inicial se já vier embutido (ex: "Lembre-se:")
              const hasHeader = rawLines[0]?.toLowerCase().includes('lembre-se');
              const headerText = hasHeader ? rawLines[0] : 'Lembre-se:';
              const bodyLines = hasHeader ? rawLines.slice(1) : rawLines;

              return (
                <ChalkItem
                  key={event.id}
                  schedule={getSchedule(event)}
                  style={{ left: posX, top: posY }}
                >
                  <div
                    className="chalk-note-box"
                    style={{
                      borderColor: boxColor,
                      boxShadow: `0 0 14px ${boxColor}26`,
                    }}
                  >
                    <span
                      className="chalk-note-box-title"
                      style={{ color: boxColor, borderColor: boxColor }}
                    >
                      {headerText}
                    </span>

                    <ul className="chalk-note-box-lines">
                      {bodyLines.map((line, idx) => {
                        // Se a linha tiver expressão LaTeX entre delimitadores ou com comandos, renderiza KaTeX
                        const isMath = /[\^=_\\/]/.test(line) || line.includes('\\Delta');
                        const lineHtml = isMath ? renderLatexToHtml(line, false) : null;

                        return (
                          <li key={idx} className="chalk-note-box-line">
                            <span className="chalk-bullet-dot" style={{ color: boxColor }}>•</span>
                            {lineHtml ? (
                              <span dangerouslySetInnerHTML={{ __html: lineHtml }} />
                            ) : (
                              <span>{line.replace(/^[•\-\*]\s*/, '')}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </ChalkItem>
              );
            }

            if (event.type === 'svg_path') {
              const svgEvent = event as SvgPathBoardEvent;
              const strokeColor = resolveChalkColor(svgEvent.strokeColor, '#F5F5DC');

              return (
                <ChalkItem
                  key={event.id}
                  schedule={getSchedule(event)}
                  style={{ left: posX, top: posY }}
                >
                  <svg width="220" height="220" className="chalk-svg-path">
                    <path
                      d={svgEvent.path}
                      stroke={strokeColor}
                      strokeWidth={svgEvent.strokeWidth || 2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ChalkItem>
              );
            }

            return null;
          })}
          </div>

          {/* Dica visual suave quando ainda não há conteúdo */}
          {renderableEvents.length === 0 && (
            <div className="chalk-empty-watermark">
              Quadro da Profa. Ana
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
