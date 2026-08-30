/**
 * AudioReplayPlayer — Controles de replay de áudio da sessão
 *
 * Mostra: ⏮10s ⏪ ▶/⏸ ⏩ ⏭10s + barra de progresso + tempo
 * Em modo "ao vivo" mostra apenas o indicador de live.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS } from '../lib/constants';

interface AudioReplayPlayerProps {
  totalDurationMs: number;
  currentTimeMs: number;
  isLive: boolean;
  onSeek: (timeMs: number) => void;
  onGoLive: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioReplayPlayer({
  totalDurationMs,
  currentTimeMs,
  isLive,
  onSeek,
  onGoLive,
}: AudioReplayPlayerProps) {
  const [barWidth, setBarWidth] = useState(1);
  const [isPlaying, setIsPlaying] = useState(!isLive);

  const progress = totalDurationMs > 0 ? Math.min(currentTimeMs / totalDurationMs, 1) : 0;

  const handleSkip = useCallback(
    (deltaMs: number) => {
      const newTime = Math.max(0, Math.min(currentTimeMs + deltaMs, totalDurationMs));
      onSeek(newTime);
    },
    [currentTimeMs, totalDurationMs, onSeek],
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / barWidth, 1));
      onSeek(ratio * totalDurationMs);
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / barWidth, 1));
      onSeek(ratio * totalDurationMs);
    },
  });

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width || 1);
  };

  if (isLive) {
    return (
      <View style={styles.liveContainer}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>AO VIVO</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Botões de controle */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => handleSkip(-10000)}
          accessibilityLabel="Voltar 10 segundos"
        >
          <Text style={styles.btnText}>⏮10s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.playBtn]}
          onPress={() => setIsPlaying((p) => !p)}
          accessibilityLabel={isPlaying ? 'Pausar' : 'Reproduzir'}
        >
          <Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => handleSkip(10000)}
          accessibilityLabel="Avançar 10 segundos"
        >
          <Text style={styles.btnText}>10s⏭</Text>
        </TouchableOpacity>

        {/* Botão para voltar ao vivo */}
        <TouchableOpacity style={styles.goLiveBtn} onPress={onGoLive}>
          <Text style={styles.goLiveText}>▶ AO VIVO</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de progresso (drag-to-seek) */}
      <View
        style={styles.progressTrack}
        onLayout={onBarLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
      </View>

      {/* Tempo atual / total */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(currentTimeMs)}</Text>
        <Text style={styles.timeText}>{formatTime(totalDurationMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backdropFilter: 'blur(10px)', // web only
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '500',
  },
  playBtn: {
    backgroundColor: COLORS.GOLD,
    borderRadius: 24,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    color: COLORS.BACKGROUND,
    fontSize: 18,
  },
  goLiveBtn: {
    backgroundColor: '#C0392B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  goLiveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.GOLD,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.GOLD,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
  },
  // Modo ao vivo
  liveContainer: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(192,57,43,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
