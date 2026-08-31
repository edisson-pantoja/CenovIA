/**
 * ChalkBoard — Quadro verde interativo do CenovIA
 *
 * Renderiza usando React Native Skia (GPU-accelerated).
 * Recebe eventos BoardEvent do GeminiLiveClient e os anima progressivamente
 * com efeito de giz (fonte Caveat + textura de ruído via shader).
 *
 * Para replay: aceita `replayTimeMs` que filtra apenas os eventos até aquele momento.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';
import {
  Canvas,
  Text as SkiaText,
  Path,
  Skia,
  Fill,
} from '@shopify/react-native-skia';
import { COLORS } from '../../lib/constants';
import type { BoardEvent } from '@cenovia/shared';
import FormulaRenderer from './FormulaRenderer';

interface ChalkBoardProps {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

export default function ChalkBoard({ events = [], replayTimeMs }: ChalkBoardProps) {
  const [font, setFont] = useState<any>(null);

  useEffect(() => {
    // Carrega a fonte manualmente no Web sem usar o useFont do Skia
    fetch('https://fonts.gstatic.com/s/caveat/v18/Wnz6HAc5bAfYB2Q7Yj82czw3aA.ttf')
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        try {
          const data = Skia.Data.fromBytes(new Uint8Array(buffer));
          const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
          if (tf) {
            setFont(Skia.Font(tf, 28));
          }
        } catch (e) {
          console.error("Erro interno do Skia ao criar fonte", e);
        }
      })
      .catch((e) => console.error('Erro de fetch na fonte:', e));
  }, []);

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  // Filtra eventos visíveis: se replayTimeMs definido, só mostra até aquele ponto
  const visibleEvents = replayTimeMs !== undefined
    ? events.filter((e) => e.timestampMs <= replayTimeMs)
    : events;

  // Encontra o último evento 'clear' para só renderizar o que veio depois
  const lastClearIndex = visibleEvents.reduceRight(
    (acc, e, idx) => (acc === -1 && e.type === 'clear' ? idx : acc),
    -1,
  );
  const renderableEvents = lastClearIndex >= 0
    ? visibleEvents.slice(lastClearIndex + 1)
    : visibleEvents;

  // Elementos WebView (LaTeX/SMILES) — renderizados sobre o canvas
  const formulaEvents = renderableEvents.filter(
    (e) => e.type === 'latex' || e.type === 'smiles',
  );

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Canvas Skia — texto e paths */}
      {canvasSize.width > 0 && (
        <Canvas style={styles.canvas}>
          {/* Fundo verde quadro */}
          <Fill color={COLORS.CHALKBOARD_GREEN} />

          {/* Renderiza cada evento visível */}
          {renderableEvents.map((event) => {
            if (!font) return null;

            if (event.type === 'text') {
              const px = (event.x ?? 0.1) * canvasSize.width;
              const py = (event.y ?? 0.2) * canvasSize.height;
              return (
                <SkiaText
                  key={event.id}
                  x={px}
                  y={py}
                  text={event.content}
                  font={font}
                  color={COLORS.CHALK_WHITE}
                />
              );
            }

            if (event.type === 'svg_path') {
              const skPath = Skia.Path.MakeFromSVGString(event.path);
              if (!skPath) return null;
              return (
                <Path
                  key={event.id}
                  path={skPath}
                  color={event.strokeColor ?? COLORS.CHALK_WHITE}
                  style="stroke"
                  strokeWidth={event.strokeWidth ?? 2}
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            }

            // latex e smiles são renderizados via FormulaRenderer (WebView) abaixo
            return null;
          })}
        </Canvas>
      )}

      {/* Fórmulas LaTeX e SMILES renderizadas via WebView sobre o canvas */}
      {formulaEvents.map((event) => {
        if (event.type !== 'latex' && event.type !== 'smiles') return null;
        const px = (event.x ?? 0.1) * canvasSize.width;
        const py = (event.y ?? 0.3) * canvasSize.height;
        return (
          <View
            key={event.id}
            style={[styles.formulaOverlay, { left: px, top: py }]}
          >
            <FormulaRenderer
              type={event.type}
              formula={event.type === 'latex' ? event.formula : event.molecule}
            />
          </View>
        );
      })}

      {/* Mensagem quando o quadro está vazio */}
      {renderableEvents.length === 0 && (
        <View style={styles.emptyHint}>
          {/* Dica visual discreta — substituída pelo conteúdo quando a professora fala */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.CHALKBOARD_GREEN,
    position: 'relative',
  },
  canvas: {
    flex: 1,
  },
  formulaOverlay: {
    position: 'absolute',
    maxWidth: 300,
  },
  emptyHint: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
