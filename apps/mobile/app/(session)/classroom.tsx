/**
 * ClassroomScreen — Tela principal de aula do CenovIA
 *
 * Layout 50/50 vertical:
 *  - Metade superior: Avatar Lottie da professora + indicador de estado + player de replay
 *  - Metade inferior: Quadro verde Skia + botão PTT (push-to-talk)
 *
 * Integra GeminiLiveClient (WebSocket) e AudioManager (expo-av).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSession } from '../../context/SessionContext';
import { geminiClient } from '../../lib/gemini-live-client';
import { audioManager } from '../../lib/audio-manager';
import { COLORS } from '../../lib/constants';
import type { BoardEvent, TeacherState, UserUsage } from '@cenovia/shared';

import TeacherAvatar from '../../components/TeacherAvatar/TeacherAvatar';
import ChalkBoardWrapper from '../../components/ChalkBoard/ChalkBoardWrapper';
import AudioReplayPlayer from '../../components/AudioReplayPlayer';
import UsageBanner from '../../components/UsageBanner';
import { webAudioRecorder, WebAudioRecorder } from '../../lib/audio-recorder';

function ClassroomScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { studyContext, usage, setUsage } = useSession();

  // ── Estado da sessão ───────────────────────────────────────────────────────
  const [teacherState, setTeacherState] = useState<TeacherState>('idle');
  const [boardEvents, setBoardEvents] = useState<BoardEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replayTimeMs, setReplayTimeMs] = useState<number | undefined>(undefined);
  const [sessionDurationMs, setSessionDurationMs] = useState(0);
  const [usageLimitReached, setUsageLimitReached] = useState(false);

  // Temporizador da sessão
  const sessionStartRef = useRef<number>(Date.now());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Conectar ao backend relay ─────────────────────────────────────────────

  useEffect(() => {
    if (!session?.access_token) return;
    
    // Se o usuário recarregou a página ou pulou o onboarding, studyContext será nulo.
    // Nesse caso, forçamos ele a voltar para a tela de escolha de matérias.
    if (!studyContext) {
      router.replace('/(auth)/onboarding');
      return;
    }

    connectToSession();

    return () => {
      geminiClient.disconnect();
      audioManager.cleanup();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectToSession = async () => {
    if (!session?.access_token || !studyContext) return;

    // Configura callbacks do cliente antes de conectar
    geminiClient.onConnected = () => {
      console.log('[CLASSROOM] Conectado ao relay');
    };

    geminiClient.onSessionReady = (_sessionId, updatedUsage) => {
      setIsConnected(true);
      setUsage(updatedUsage);
      setTeacherState('idle');
      // Inicia temporizador de duração da sessão
      sessionStartRef.current = Date.now();
      durationTimerRef.current = setInterval(() => {
        setSessionDurationMs(Date.now() - sessionStartRef.current);
      }, 1000);
    };

    geminiClient.onAudioChunk = async (data, timestampMs, mimeType) => {
      await audioManager.playAudioChunk(data, timestampMs, mimeType);
    };

    geminiClient.onBoardEvent = (event) => {
      setBoardEvents((prev) => [...prev, event]);
    };

    geminiClient.onTeacherStateChange = (state) => {
      setTeacherState(state);
    };

    geminiClient.onUsageUpdate = (updatedUsage: UserUsage) => {
      setUsage(updatedUsage);
    };

    geminiClient.onUsageLimitReached = () => {
      setUsageLimitReached(true);
      setIsConnected(false);
      Alert.alert(
        'Limite de minutos atingido',
        'Você usou todos os seus 30 minutos gratuitos este mês. Aguarde o próximo mês para continuar.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    };

    geminiClient.onError = (code, message) => {
      console.error('[CLASSROOM] Erro:', code, message);
      if (code === 'AUTH_FAILED') {
        Alert.alert('Erro de autenticação', 'Faça login novamente.');
        router.replace('/(auth)/sign-in');
      } else {
        Alert.alert('Erro de conexão', message);
      }
    };

    geminiClient.onDisconnected = () => {
      setIsConnected(false);
      setTeacherState('idle');
    };

    try {
      await geminiClient.connect(session.access_token, studyContext);
    } catch (err) {
      Alert.alert(
        'Erro ao conectar',
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
      router.back();
    }
  };

  // ── Push-To-Talk (gravação de voz) ─────────────────────────────────────────

  const handlePTTStart = useCallback(async () => {
    if (!isConnected || usageLimitReached) return;

    try {
      if (Platform.OS === 'web' && WebAudioRecorder.isSupported()) {
        const ok = await webAudioRecorder.start();
        if (!ok) {
          Alert.alert('Permissão necessária', 'Permita o acesso ao microfone no navegador.');
          return;
        }
      } else {
        await audioManager.startRecording();
      }
      // Para a fala atual da professora ao pressionar o botão
      audioManager.clearPlayback();
      setIsRecording(true);
      setTeacherState('listening');
      setReplayTimeMs(undefined);
    } catch (err) {
      Alert.alert('Permissão necessária', 'Habilite o microfone nas configurações.');
    }
  }, [isConnected, usageLimitReached]);

  const handlePTTEnd = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setTeacherState('thinking');

    try {
      if (Platform.OS === 'web' && WebAudioRecorder.isSupported()) {
        // Web: usa MediaRecorder nativo do browser
        const result = await webAudioRecorder.stop();
        if (result && geminiClient.isConnected) {
          const { blob, mimeType } = result;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            geminiClient.sendAudioChunk(base64, mimeType);
            geminiClient.sendTurnComplete();
          };
          reader.readAsDataURL(blob);
        } else {
          setTeacherState('idle');
        }
      } else {
        // Native (iOS/Android): usa expo-av
        const uri = await audioManager.stopRecording();
        if (uri && geminiClient.isConnected) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            geminiClient.sendAudioChunk(base64, 'audio/pcm;rate=16000');
            geminiClient.sendTurnComplete();
          };
          reader.readAsDataURL(blob);
        } else {
          setTeacherState('idle');
        }
      }
    } catch (err) {
      console.error('[CLASSROOM] Erro ao enviar áudio:', err);
      setTeacherState('idle');
    }
  }, [isRecording]);

  // ── Replay ────────────────────────────────────────────────────────────────

  const handleSeek = useCallback((timeMs: number) => {
    setReplayTimeMs(timeMs);
  }, []);

  const handleReplayEnd = useCallback(() => {
    setReplayTimeMs(undefined); // Volta ao estado atual
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const subjectLabel = studyContext?.subjectName ?? 'CenovIA';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Voltar">
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{subjectLabel}</Text>
        <TouchableOpacity style={styles.headerBtn} accessibilityLabel="Configurações">
          <Text style={styles.headerBtnText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Banner de uso do free tier */}
      {usage && <UsageBanner minutes={usage.minutesRemaining} />}

      {/* Split 50/50 */}
      <View style={styles.split}>

        {/* ── Metade superior: Professora ─────────────────────────── */}
        <View style={styles.teacherSection}>
          <TeacherAvatar state={teacherState} />

          {/* Player de replay — aparece quando há áudio gravado */}
          {audioManager.getTotalBufferedDuration() > 0 && (
            <AudioReplayPlayer
              totalDurationMs={audioManager.getTotalBufferedDuration()}
              currentTimeMs={replayTimeMs ?? audioManager.getTotalBufferedDuration()}
              isLive={replayTimeMs === undefined}
              onSeek={handleSeek}
              onGoLive={handleReplayEnd}
            />
          )}

          {/* Indicador de estado da conexão */}
          {!isConnected && (
            <View style={styles.connectingOverlay}>
              <Text style={styles.connectingText}>
                {usageLimitReached ? '⛔ Limite atingido' : '⏳ Conectando...'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Metade inferior: Quadro verde ───────────────────────── */}
        <View style={styles.boardSection}>
          <ChalkBoardWrapper
            events={boardEvents}
            replayTimeMs={replayTimeMs}
          />

          {/* Botão Push-To-Talk */}
          {!usageLimitReached && (
            <Pressable
              style={({ pressed }) => [
                styles.pttButton,
                isRecording && styles.pttButtonActive,
                pressed && styles.pttButtonPressed,
              ]}
              onPressIn={handlePTTStart}
              onPressOut={handlePTTEnd}
              accessibilityLabel="Segure para falar com a professora"
              accessibilityRole="button"
            >
              <Text style={styles.pttText}>
                {isRecording ? '🔴 Ouvindo...' : '🎤 Segure para falar'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

class ClassroomErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, errorMsg: string}> {
  state = { hasError: false, errorMsg: '' };
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error?.message || 'Unknown error' }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error("Classroom Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) return <SafeAreaView style={styles.container}><Text style={{color:'red', margin:20}}>Erro crítico na sala: {this.state.errorMsg}</Text></SafeAreaView>;
    return this.props.children;
  }
}

export default function ClassroomScreenWithBoundary() {
  return <ClassroomErrorBoundary><ClassroomScreen /></ClassroomErrorBoundary>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  split: {
    flex: 1,
    flexDirection: 'column',
  },
  teacherSection: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardSection: {
    flex: 1,
    backgroundColor: COLORS.CHALKBOARD_GREEN,
    position: 'relative',
  },
  connectingOverlay: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectingText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
  },
  pttButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 200,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  pttButtonActive: {
    backgroundColor: 'rgba(220,50,50,0.7)',
    borderColor: 'rgba(255,100,100,0.6)',
  },
  pttButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  pttText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
