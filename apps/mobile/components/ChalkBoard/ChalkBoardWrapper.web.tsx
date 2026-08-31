/**
 * ChalkBoardWrapper.web.tsx — Versão Web pura do quadro verde
 *
 * Usa HTML5 Canvas diretamente (sem Skia, sem WASM) para máxima compatibilidade no navegador.
 * O Skia continua sendo usado nas versões iOS/Android via ChalkBoard.tsx.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../lib/constants';
import type { BoardEvent } from '@cenovia/shared';

interface Props {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

export default function ChalkBoardWrapper({ events = [], replayTimeMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filtra eventos visíveis
  const visibleEvents = replayTimeMs !== undefined
    ? events.filter((e) => e.timestampMs <= replayTimeMs)
    : events;

  const lastClearIndex = visibleEvents.reduceRight(
    (acc, e, idx) => (acc === -1 && e.type === 'clear' ? idx : acc),
    -1,
  );
  const renderableEvents = lastClearIndex >= 0
    ? visibleEvents.slice(lastClearIndex + 1)
    : visibleEvents;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpa e repinta o fundo verde
    ctx.fillStyle = COLORS.CHALKBOARD_GREEN;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fonte que imita giz
    ctx.font = '28px "Caveat", cursive';
    ctx.fillStyle = COLORS.CHALK_WHITE;

    for (const event of renderableEvents) {
      if (event.type === 'text') {
        const px = (event.x ?? 0.1) * canvas.width;
        const py = (event.y ?? 0.2) * canvas.height;
        ctx.fillStyle = COLORS.CHALK_WHITE;
        ctx.font = '28px "Caveat", cursive';
        ctx.fillText(event.content, px, py);
      }

      if (event.type === 'svg_path') {
        try {
          const path = new Path2D(event.path);
          ctx.strokeStyle = event.strokeColor ?? COLORS.CHALK_WHITE;
          ctx.lineWidth = event.strokeWidth ?? 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke(path);
        } catch (e) {
          console.warn('Erro ao renderizar SVG path:', e);
        }
      }
    }
  }, [renderableEvents]);

  return (
    <View style={styles.container}>
      {/* Importa a fonte Caveat do Google Fonts */}
      {/* @ts-ignore */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat&display=swap');`}</style>
      {/* @ts-ignore */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        width={800}
        height={600}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.CHALKBOARD_GREEN,
  },
});
