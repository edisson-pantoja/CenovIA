/**
 * ClassroomScreen — Tela principal de aula do CenovIA
 *
 * Reproduz fielmente a interface da Profa. Ana:
 *  - Header: Profa. Ana / Reforço Escolar, indicador "Ao vivo" + cronômetro, Configurações e botão vermelho Encerrar
 *  - Metade superior: Câmera da Profa. Ana com badge "Online", efeitos de fala e PIP do aluno
 *  - Metade inferior: Quadro verde ardósia com ferramentas e fórmulas KaTeX
 *  - Barra inferior: Ações "Enviar imagem", "Anexos", campo de texto, botão PTT e botão azul "Enviar"
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Alert,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSession } from '../../context/SessionContext';
import { geminiClient } from '../../lib/gemini-live-client';
import { audioManager } from '../../lib/audio-manager';
import { COLORS } from '../../lib/constants';
import type { BoardEvent, StudyPlanState, TeacherState, UserUsage } from '@cenovia/shared';

import ChalkBoardWrapper from '../../components/ChalkBoard/ChalkBoardWrapper';
import AudioReplayPlayer from '../../components/AudioReplayPlayer';
import UsageBanner from '../../components/UsageBanner';
import { webAudioRecorder, WebAudioRecorder } from '../../lib/audio-recorder';

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function ClassroomScreen() {
  const router = useRouter();
  const { session, user, signOut } = useAuth();
  const { studyContext, usage, setUsage } = useSession();

  // ── Estado da sessão ───────────────────────────────────────────────────────
  const [teacherState, setTeacherState] = useState<TeacherState>('idle');
  const [boardEvents, setBoardEvents] = useState<BoardEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replayTimeMs, setReplayTimeMs] = useState<number | undefined>(undefined);
  const [sessionDurationMs, setSessionDurationMs] = useState(0);
  const [usageLimitReached, setUsageLimitReached] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'warning' | 'error' } | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlanState | null>(null);
  const [planOpen, setPlanOpen] = useState(true);

  // Temporizador da sessão
  const sessionStartRef = useRef<number>(Date.now());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showToast = useCallback((message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // ── Conectar ao backend relay ─────────────────────────────────────────────

  useEffect(() => {
    if (!session?.access_token) return;
    if (!studyContext) {
      router.replace('/(auth)/onboarding');
      return;
    }

    connectToSession();

    return () => {
      geminiClient.disconnect();
      audioManager.cleanup();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectToSession = async () => {
    if (!session?.access_token || !studyContext) return;

    geminiClient.onConnected = () => {
      console.log('[CLASSROOM] Conectado ao relay');
    };

    geminiClient.onSessionReady = (_sessionId, updatedUsage) => {
      setIsConnected(true);
      setUsage(updatedUsage);
      setTeacherState('idle');
      sessionStartRef.current = Date.now();
      durationTimerRef.current = setInterval(() => {
        setSessionDurationMs(Date.now() - sessionStartRef.current);
      }, 1000);
    };

    geminiClient.onAudioChunk = async (data, timestampMs) => {
      await audioManager.playAudioChunk(data, timestampMs);
    };

    geminiClient.onBoardEvent = (event) => {
      setBoardEvents((prev) => [...prev, event]);
    };

    geminiClient.onTeacherStateChange = (state) => {
      setTeacherState(state);
      if (state === 'reconnecting') {
        showToast('Reconectando à professora...', 'warning');
      }
    };

    geminiClient.onStudyPlan = (plan) => {
      setStudyPlan(plan);
    };

    geminiClient.onInterrupted = () => {
      console.log('[CLASSROOM] Professora interrompida pelo aluno');
      audioManager.clearPlayback();
    };

    geminiClient.onUsageUpdate = (updatedUsage: UserUsage) => {
      setUsage(updatedUsage);
    };

    geminiClient.onUsageLimitReached = () => {
      setUsageLimitReached(true);
      setIsConnected(false);
      showToast('Limite de minutos atingido (30 min gratuitos este mês).', 'error');
    };

    geminiClient.onError = (code, message) => {
      console.error('[CLASSROOM] Erro:', code, message);
      if (code === 'AUTH_FAILED') {
        showToast('Erro de autenticação. Redirecionando para login...', 'error');
        setTimeout(() => router.replace('/(auth)/sign-in'), 1500);
      } else if (code === 'GEMINI_DISCONNECTED') {
        showToast('Conexão com a IA perdida após várias tentativas.', 'error');
      } else if (code !== 'TIMEOUT') {
        showToast(message || 'Aviso na conexão com a IA', 'warning');
      }
    };

    geminiClient.onDisconnected = () => {
      setIsConnected(false);
      setTeacherState('idle');
    };

    try {
      await geminiClient.connect(session.access_token, studyContext);
    } catch (err) {
      showToast('Não foi possível conectar ao servidor. Tentando reconectar...', 'error');
    }
  };

  // ── Câmera do aluno (vídeo ao vivo + frames para a professora ver o caderno/gestos) ──

  const stopCamera = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (Platform.OS !== 'web' || !navigator.mediaDevices?.getUserMedia) {
      showToast('Câmera não disponível neste dispositivo.', 'warning');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      showToast('Permita o acesso à câmera no navegador para mostrar seu caderno.', 'warning');
    }
  }, [showToast]);

  // Liga o preview e envia ~1 frame/segundo (JPEG pequeno) à professora enquanto a câmera estiver ativa
  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    frameTimerRef.current = setInterval(() => {
      if (!ctx || video.readyState < 2 || !geminiClient.isConnected) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      if (b64) geminiClient.sendVideoFrame(b64);
    }, 1000);

    return () => {
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
    };
  }, [cameraOn]);

  const handleEndSession = () => {
    stopCamera();
    geminiClient.disconnect();
    audioManager.cleanup();
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    // Na web não há histórico para voltar: vai direto para a escolha de matéria
    router.replace('/(auth)/onboarding');
  };

  const handleSignOut = async () => {
    stopCamera();
    geminiClient.disconnect();
    audioManager.cleanup();
    await signOut();
    router.replace('/(auth)/welcome');
  };

  // ── Push-To-Talk (gravação de voz) ─────────────────────────────────────────

  const handlePTTStart = useCallback(async () => {
    if (!isConnected || usageLimitReached) return;
    try {
      if (Platform.OS === 'web' && WebAudioRecorder.isSupported()) {
        geminiClient.sendPTTStart();
        webAudioRecorder.onChunk = (base64: string, mimeType: string) => {
          geminiClient.sendAudioChunk(base64, mimeType);
        };
        const ok = await webAudioRecorder.start();
        if (!ok) {
          webAudioRecorder.onChunk = undefined;
          showToast('Permita o acesso ao microfone no navegador para falar com a professora.', 'warning');
          return;
        }
      } else {
        await audioManager.startRecording();
      }
      audioManager.clearPlayback();
      setIsRecording(true);
      setTeacherState('listening');
      setReplayTimeMs(undefined);
    } catch (err) {
      showToast('Habilite o microfone nas permissões para usar a voz.', 'warning');
    }
  }, [isConnected, usageLimitReached, showToast]);

  const handlePTTEnd = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setTeacherState('thinking');

    try {
      if (Platform.OS === 'web' && WebAudioRecorder.isSupported()) {
        await webAudioRecorder.stop();
        if (geminiClient.isConnected) {
          geminiClient.sendTurnComplete();
        } else {
          setTeacherState('idle');
        }
      } else {
        const uri = await audioManager.stopRecording();
        if (uri && geminiClient.isConnected) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            if (base64) geminiClient.sendAudioChunk(base64, 'audio/pcm;rate=16000');
            geminiClient.sendTurnComplete();
          };
          reader.readAsDataURL(blob);
        } else {
          setTeacherState('idle');
        }
      }
    } catch (err) {
      console.error('[CLASSROOM] Erro ao parar gravação:', err);
      setTeacherState('idle');
    }
  }, [isRecording]);

  // ── Envio de mensagem de texto ────────────────────────────────────────────

  const handleSendTextMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed || !isConnected) return;
    setInputText('');
    setTeacherState('thinking');
    geminiClient.sendTextMessage(trimmed);
  };

  // ── Envio de imagem (caderno / exercício) ──────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      if (base64Data) {
        setTeacherState('thinking');
        showToast('Enviando foto do caderno para a professora...', 'info');
        geminiClient.sendImageMessage(
          base64Data,
          mimeType,
          'Professora, por favor analise a anotação/exercício da foto do meu caderno e me explique no quadro verde passo a passo.',
        );
      }
      setIsUploadingImage(false);
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      showToast('Não foi possível ler a imagem selecionada.', 'error');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleTriggerImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ── Replay ────────────────────────────────────────────────────────────────

  const handleSeek = useCallback((timeMs: number) => {
    setReplayTimeMs(timeMs);
  }, []);

  const handleReplayEnd = useCallback(() => {
    setReplayTimeMs(undefined);
  }, []);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <div className="cenovia-app-layout">
        <style>{`
          .cenovia-app-layout {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100vh;
            background-color: #0b131a;
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
          }

          /* ── Barra Superior (Header) ── */
          .cenovia-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            padding: 0 20px;
            background-color: #0f1722;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            z-index: 20;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .header-brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .header-brand-icon {
            width: 28px;
            height: 28px;
            fill: none;
            stroke: #60a5fa;
            stroke-width: 2;
          }

          .header-brand-titles {
            display: flex;
            flex-direction: column;
          }

          .header-brand-name {
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            line-height: 1.2;
          }

          .header-brand-subtitle {
            font-size: 11px;
            font-weight: 400;
            color: #94a3b8;
          }

          .header-live-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #ffffff;
            margin-left: 6px;
          }

          .live-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #10b981;
            box-shadow: 0 0 8px #10b981;
            animation: pulseDot 2s infinite ease-in-out;
          }

          @keyframes pulseDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }

          .header-separator {
            color: rgba(255, 255, 255, 0.2);
            font-size: 14px;
          }

          .header-timer {
            font-size: 13px;
            font-weight: 500;
            color: #e2e8f0;
            font-variant-numeric: tabular-nums;
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .header-settings-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: transparent;
            border: none;
            color: #cbd5e1;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 8px;
            transition: background 0.2s;
          }

          .header-settings-btn:hover {
            background: rgba(255, 255, 255, 0.06);
          }

          .header-end-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: #ef4444;
            border: none;
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            padding: 8px 16px;
            border-radius: 20px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
          }

          .header-end-btn:hover {
            background: #dc2626;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.45);
          }

          /* ── Painel lateral: Plano de estudos ── */
          .cenovia-main-row {
            flex: 1;
            display: flex;
            flex-direction: row;
            min-height: 0;
            overflow: hidden;
          }

          .cenovia-main-row > .cenovia-body-split { flex: 1; min-width: 0; }

          .study-panel {
            width: 250px;
            flex-shrink: 0;
            background: #0f1722;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: width 0.25s ease;
          }

          .study-panel.collapsed { width: 40px; }

          .study-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 12px 8px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #94a3b8;
          }

          .study-panel.collapsed .study-panel-title,
          .study-panel.collapsed .study-panel-theme,
          .study-panel.collapsed .study-topic-list,
          .study-panel.collapsed .study-panel-progress,
          .study-panel.collapsed .study-panel-empty { display: none; }

          .study-panel-toggle {
            background: transparent;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 16px;
            padding: 2px 6px;
          }

          .study-panel-theme {
            padding: 0 12px 8px;
            font-size: 15px;
            font-weight: 700;
            color: #fde68a;
          }

          .study-panel-progress {
            margin: 0 12px 10px;
            height: 4px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            overflow: hidden;
          }

          .study-panel-progress > div {
            height: 100%;
            background: #10b981;
            transition: width 0.4s ease;
          }

          .study-panel-empty {
            padding: 8px 14px;
            font-size: 13px;
            color: #64748b;
            line-height: 1.5;
          }

          .study-topic-list {
            list-style: none;
            margin: 0;
            padding: 0 8px 12px;
            overflow-y: auto;
            flex: 1;
          }

          .study-topic {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            width: 100%;
            text-align: left;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 10px;
            padding: 9px 10px;
            margin-bottom: 4px;
            color: #cbd5e1;
            font-size: 13px;
            line-height: 1.35;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
          }

          .study-topic:hover { background: rgba(255, 255, 255, 0.06); }

          .study-topic.current {
            background: rgba(59, 130, 246, 0.16);
            border-color: rgba(59, 130, 246, 0.55);
            color: #ffffff;
            font-weight: 600;
          }

          .study-topic.done { color: #6ee7b7; }
          .study-topic.done .study-topic-text { text-decoration: line-through; opacity: 0.8; }

          .study-topic-flag {
            flex-shrink: 0;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 1.5px solid #475569;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            margin-top: 1px;
          }

          .study-topic.done .study-topic-flag { background: #10b981; border-color: #10b981; color: #052e1f; }
          .study-topic.current .study-topic-flag { border-color: #60a5fa; }

          @media (max-width: 720px) {
            .study-panel { width: 190px; }
          }

          /* ── Corpo Principal (Split 50/50) ── */
          .cenovia-body-split {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          /* ── Metade Superior: Vídeo da Professora ── */
          .teacher-video-container {
            flex: 1;
            position: relative;
            background-color: #0b131a;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .teacher-video-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center 25%;
            transition: transform 0.3s ease;
          }

          /* Indicador de fala da professora */
          .teacher-speaking-pulse {
            position: absolute;
            inset: 0;
            pointer-events: none;
            border: 3px solid transparent;
            transition: all 0.3s ease;
          }

          .teacher-speaking-pulse.speaking {
            border-color: rgba(16, 185, 129, 0.65);
            box-shadow: inset 0 0 35px rgba(16, 185, 129, 0.35);
          }

          .teacher-speaking-pulse.thinking {
            border-color: rgba(245, 158, 11, 0.65);
            box-shadow: inset 0 0 35px rgba(245, 158, 11, 0.25);
          }

          .teacher-speaking-pulse.reconnecting {
            border-color: rgba(245, 158, 11, 0.75);
            box-shadow: inset 0 0 45px rgba(245, 158, 11, 0.35);
            animation: pulseSpeaking 1.5s infinite ease-in-out;
          }

          /* ── Toast Discreto Flutuante ── */
          .cenovia-toast-container {
            position: absolute;
            top: 66px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 18px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
            animation: slideDownToast 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            backdrop-filter: blur(12px);
            max-width: 90%;
            pointer-events: none;
          }

          .toast-info {
            background: rgba(30, 41, 59, 0.92);
            border: 1px solid rgba(96, 165, 250, 0.4);
            color: #93c5fd;
          }

          .toast-warning {
            background: rgba(41, 37, 36, 0.94);
            border: 1px solid rgba(245, 158, 11, 0.5);
            color: #fde68a;
          }

          .toast-error {
            background: rgba(45, 20, 20, 0.94);
            border: 1px solid rgba(239, 68, 68, 0.5);
            color: #fca5a5;
          }

          @keyframes slideDownToast {
            from {
              opacity: 0;
              transform: translate(-50%, -10px);
            }
            to {
              opacity: 1;
              transform: translate(-50%, 0);
            }
          }

          /* Badge: Câmera da professora • Online */
          .teacher-cam-badge {
            position: absolute;
            top: 14px;
            left: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            padding: 6px 14px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            font-size: 12px;
            font-weight: 500;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }

          .cam-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #10b981;
          }

          /* Card: Aluno PIP (Canto Superior Direito) */
          .student-pip-card {
            position: absolute;
            top: 14px;
            right: 18px;
            width: 154px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
          }

          .student-pip-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
          }

          .student-avatar-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #2563eb;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            font-weight: 600;
          }

          .student-pip-info {
            display: flex;
            flex-direction: column;
          }

          .student-pip-name {
            font-size: 12px;
            font-weight: 600;
            color: #ffffff;
          }

          .student-pip-status {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: #10b981;
            font-weight: 500;
          }

          .student-pip-preview {
            width: 100%;
            height: 88px;
            position: relative;
            background: #1e293b;
          }

          .student-pip-preview-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .student-cam-tag {
            position: absolute;
            bottom: 6px;
            left: 6px;
            background: rgba(0, 0, 0, 0.65);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            color: #e2e8f0;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          /* ── Metade Inferior: Quadro Verde ── */
          .chalkboard-section-container {
            flex: 1;
            position: relative;
            overflow: hidden;
            display: flex;
          }

          /* ── Layout em coluna lateral: professora (4:3) + aluno, quadro verde ocupa o resto ── */
          .cenovia-main-row > .cenovia-body-split { flex-direction: row-reverse; }

          .cenovia-body-split .teacher-video-container {
            flex: none;
            width: clamp(260px, 26vw, 360px);
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 10px;
            padding: 10px;
            box-sizing: border-box;
            border-left: 1px solid rgba(255, 255, 255, 0.06);
          }

          .teacher-video-frame {
            position: relative;
            flex: none;
            width: 100%;
            aspect-ratio: 4 / 3;
            border-radius: 14px;
            overflow: hidden;
            background: #0b131a;
          }

          .teacher-video-frame .teacher-cam-badge { top: 8px; left: 8px; padding: 4px 10px; font-size: 11px; }

          .cenovia-body-split .student-pip-card {
            position: relative;
            top: auto;
            right: auto;
            width: 100%;
            flex: 1;
            min-height: 130px;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }

          .cenovia-body-split .student-pip-preview {
            flex: 1;
            height: auto;
            min-height: 0;
          }

          .student-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }

          .student-cam-off {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #94a3b8;
            font-size: 12px;
            text-align: center;
            padding: 8px;
          }

          .student-cam-off-circle {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #2563eb;
            color: #fff;
            font-size: 20px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .student-cam-on-btn {
            background: #2563eb;
            border: none;
            color: #fff;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
          }

          .student-cam-on-btn:hover { background: #1d4ed8; }
          .student-cam-dot-off { background-color: #64748b !important; }

          .chat-action-btn.cam-active {
            background: rgba(239, 68, 68, 0.18);
            border-color: rgba(239, 68, 68, 0.6);
            color: #fecaca;
          }

          @media (max-width: 900px) {
            .cenovia-main-row > .cenovia-body-split { flex-direction: column; }
            .cenovia-body-split .teacher-video-container {
              width: auto;
              flex-direction: row;
              height: 150px;
              border-left: none;
            }
            .teacher-video-frame { width: auto; height: 100%; flex: none; }
            .cenovia-body-split .student-pip-card { min-height: 0; }
          }

          /* ── Modal de Configurações ── */
          .settings-overlay {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 12, 0.65);
            backdrop-filter: blur(4px);
            z-index: 200;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .settings-modal {
            width: min(420px, 92vw);
            background: #0f1722;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 22px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          }

          .settings-modal h2 { margin: 0 0 14px; font-size: 17px; }
          .settings-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            font-size: 13px;
            color: #cbd5e1;
          }
          .settings-row strong { color: #fff; font-weight: 600; }
          .settings-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }
          .settings-btn {
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(255, 255, 255, 0.14);
            color: #e2e8f0;
            font-size: 13px;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 10px;
            cursor: pointer;
          }
          .settings-btn:hover { background: rgba(255, 255, 255, 0.14); }
          .settings-btn.danger { background: #ef4444; border-color: #ef4444; color: #fff; }
          .settings-btn.danger:hover { background: #dc2626; }

          /* ── Barra Inferior de Chat & Ações (Mockup) ── */
          .cenovia-chat-bar {
            height: 64px;
            background-color: #0d1520;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 12px;
            z-index: 20;
          }

          .chat-action-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #cbd5e1;
            font-size: 13px;
            font-weight: 500;
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
          }

          .chat-action-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.2);
          }

          .chat-input-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            background: #152230;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 24px;
            padding: 0 14px;
            height: 42px;
            transition: border-color 0.2s;
          }

          .chat-input-wrapper:focus-within {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
          }

          .chat-input-field {
            flex: 1;
            background: transparent;
            border: none;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            font-family: inherit;
          }

          .chat-input-field::placeholder {
            color: #64748b;
          }

          .chat-emoji-btn {
            background: transparent;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
            opacity: 0.75;
            transition: opacity 0.2s;
          }

          .chat-emoji-btn:hover {
            opacity: 1;
          }

          /* Botão PTT (Microfone) integrado */
          .chat-ptt-btn {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            border: 1.5px solid rgba(255, 255, 255, 0.2);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s;
            user-select: none;
          }

          .chat-ptt-btn:hover {
            background: rgba(255, 255, 255, 0.15);
          }

          .chat-ptt-btn.recording {
            background: #ef4444;
            border-color: #f87171;
            animation: pulseRec 1.2s infinite ease-in-out;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
          }

          @keyframes pulseRec {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }

          /* Botão Azul "Enviar" */
          .chat-send-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #2563eb;
            border: none;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 20px;
            border-radius: 24px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
          }

          .chat-send-btn:hover {
            background: #1d4ed8;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.45);
          }

          .chat-send-btn:disabled {
            background: #1e3a5f;
            color: #64748b;
            cursor: not-allowed;
            box-shadow: none;
          }
        `}</style>

        {/* ── Input oculto para upload de imagem da câmera/exercício ── */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        {/* ── 1. Header (Identidade Visual da Imagem) ── */}
        <header className="cenovia-header">
          <div className="header-left">
            <div className="header-brand">
              <svg className="header-brand-icon" viewBox="0 0 24 24">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              <div className="header-brand-titles">
                <span className="header-brand-name">Profa. Ana</span>
                <span className="header-brand-subtitle">
                  {studyContext?.subjectName ? `Reforço • ${studyContext.subjectName}` : 'Reforço Escolar'}
                </span>
              </div>
            </div>

            <div className="header-live-badge">
              <span className="live-dot" />
              <span>Ao vivo</span>
            </div>

            <span className="header-separator">|</span>

            <span className="header-timer">
              {formatTimer(sessionDurationMs)}
            </span>
          </div>

          <div className="header-right">
            <button className="header-settings-btn" title="Configurações" onClick={() => setSettingsOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Configurações</span>
            </button>

            <button className="header-end-btn" onClick={handleEndSession} title="Encerrar Aula">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" transform="rotate(45 12 12)" />
              </svg>
              <span>Encerrar</span>
            </button>
          </div>
        </header>

        {/* ── Toast Notificação Discreta Flutuante ── */}
        {toast && (
          <div className={`cenovia-toast-container toast-${toast.type}`}>
            {toast.type === 'warning' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* ── Banner de Minutos do Free Tier (se necessário) ── */}
        {usage && usage.minutesRemaining < 30 && (
          <UsageBanner minutesRemaining={usage.minutesRemaining} minutesLimit={usage.minutesLimit} />
        )}

        {/* ── 2. Linha principal: Painel de tópicos + (Vídeo Professora / Quadro Verde) ── */}
        <div className="cenovia-main-row">
        <aside className={`study-panel ${planOpen ? '' : 'collapsed'}`} aria-label="Plano de estudos">
          <div className="study-panel-header">
            <span className="study-panel-title">Plano de estudos</span>
            <button
              className="study-panel-toggle"
              onClick={() => setPlanOpen((v) => !v)}
              title={planOpen ? 'Recolher painel' : 'Abrir plano de estudos'}
            >
              {planOpen ? '‹' : '›'}
            </button>
          </div>
          {studyPlan && studyPlan.topics.length > 0 ? (
            <>
              <div className="study-panel-theme">{studyPlan.theme || studyContext?.subjectName}</div>
              <div className="study-panel-progress">
                <div
                  style={{
                    width: `${Math.round((studyPlan.topics.filter((t) => t.done).length / studyPlan.topics.length) * 100)}%`,
                  }}
                />
              </div>
              <ul className="study-topic-list">
                {studyPlan.topics.map((t) => (
                  <li key={t.id}>
                    <button
                      className={`study-topic ${t.done ? 'done' : ''} ${t.id === studyPlan.currentTopicId ? 'current' : ''}`}
                      onClick={() => {
                        if (!isConnected) return;
                        geminiClient.sendTextMessage(`Quero ir para o tópico "${t.title}" do plano de estudos.`);
                      }}
                      title="Ir para este tópico"
                    >
                      <span className="study-topic-flag">{t.done ? '✓' : ''}</span>
                      <span className="study-topic-text">{t.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="study-panel-empty">
              Diga à professora o que você quer estudar. Os tópicos da aula aparecerão aqui e serão marcados à medida que forem concluídos.
            </div>
          )}
        </aside>

        {/* ── Corpo Split (50% Vídeo Professora / 50% Quadro Verde) ── */}
        <div className="cenovia-body-split">

          {/* ── Metade Superior: Vídeo da Professora + PIP do Aluno ── */}
          <section className="teacher-video-container" aria-label="Transmissão da professora">
            <div className="teacher-video-frame">
            <Image
              source={require('../../assets/images/teacher.jpg')}
              style={styles.teacherVideoImage}
              resizeMode="cover"
            />

            {/* Aura sutil quando a professora está falando ou pensando */}
            <div className={`teacher-speaking-pulse ${teacherState}`} />

            {/* Badge: Câmera da professora • Online / Reconectando */}
            <div className="teacher-cam-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>Câmera da professora</span>
              <span
                className="cam-dot"
                style={{
                  backgroundColor: teacherState === 'reconnecting' ? '#f59e0b' : '#10b981',
                }}
              />
              <span
                style={{
                  color: teacherState === 'reconnecting' ? '#f59e0b' : '#10b981',
                  fontWeight: 600,
                }}
              >
                {teacherState === 'reconnecting' ? 'Reconectando...' : 'Online'}
              </span>
            </div>
            </div>

            {/* Card: Aluno (vídeo real da câmera ou avatar com botão para ligar) */}
            <div className="student-pip-card">
              <div className="student-pip-header">
                <div className="student-avatar-icon">A</div>
                <div className="student-pip-info">
                  <span className="student-pip-name">Aluno</span>
                  <div className="student-pip-status" style={{ color: cameraOn ? '#10b981' : '#94a3b8' }}>
                    <span className={`cam-dot ${cameraOn ? '' : 'student-cam-dot-off'}`} />
                    <span>{cameraOn ? 'Câmera ativa' : 'Câmera desligada'}</span>
                  </div>
                </div>
              </div>
              <div className="student-pip-preview">
                {cameraOn ? (
                  <video ref={videoRef} className="student-video" muted playsInline />
                ) : (
                  <div className="student-cam-off">
                    <div className="student-cam-off-circle">{(user?.email?.[0] || 'A').toUpperCase()}</div>
                    <button className="student-cam-on-btn" onClick={startCamera}>Ligar câmera</button>
                  </div>
                )}
              </div>
            </div>

            {/* Player de Replay (se houver buffer) */}
            {audioManager.getTotalBufferedDuration() > 0 && (
              <AudioReplayPlayer
                totalDurationMs={audioManager.getTotalBufferedDuration()}
                currentTimeMs={replayTimeMs ?? audioManager.getTotalBufferedDuration()}
                isLive={replayTimeMs === undefined}
                onSeek={handleSeek}
                onGoLive={handleReplayEnd}
              />
            )}
          </section>

          {/* ── Metade Inferior: Quadro Verde com Ferramentas ── */}
          <section className="chalkboard-section-container" aria-label="Quadro verde">
            <ChalkBoardWrapper
              events={boardEvents}
              replayTimeMs={replayTimeMs}
            />
          </section>
        </div>
        </div>

        {/* ── 3. Barra Inferior de Chat & Ações (Exatamente como o Mockup) ── */}
        <footer className="cenovia-chat-bar">
          <button
            className="chat-action-btn"
            onClick={handleTriggerImageUpload}
            title="Enviar foto do exercício ou caderno"
            disabled={isUploadingImage}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{isUploadingImage ? 'Enviando...' : 'Enviar imagem'}</span>
          </button>

          <button
            className="chat-action-btn"
            onClick={handleTriggerImageUpload}
            title="Anexar arquivo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span>Anexos</span>
          </button>

          {/* Campo de Digitação */}
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="chat-input-field"
              placeholder="Digite sua mensagem..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendTextMessage();
              }}
            />
            <button className="chat-emoji-btn" title="Inserir emoji">
              🙂
            </button>
          </div>

          {/* Botão de Câmera (mostrar caderno / gestos à professora) */}
          <button
            className={`chat-action-btn ${cameraOn ? 'cam-active' : ''}`}
            onClick={cameraOn ? stopCamera : startCamera}
            title={cameraOn ? 'Desligar câmera' : 'Ligar câmera para mostrar algo à professora'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span>{cameraOn ? 'Desligar câmera' : 'Câmera'}</span>
          </button>

          {/* Botão Push-to-Talk (Microfone) */}
          <button
            className={`chat-ptt-btn ${isRecording ? 'recording' : ''}`}
            onMouseDown={handlePTTStart}
            onMouseUp={handlePTTEnd}
            onTouchStart={handlePTTStart}
            onTouchEnd={handlePTTEnd}
            title="Segure para falar com a Profa. Ana"
          >
            {isRecording ? '🔴' : '🎤'}
          </button>

          {/* Botão Azul "Enviar" */}
          <button
            className="chat-send-btn"
            onClick={handleSendTextMessage}
            disabled={!inputText.trim()}
            title="Enviar mensagem para a professora"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
            <span>Enviar</span>
          </button>
        </footer>

        {/* ── Modal de Configurações ── */}
        {settingsOpen && (
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Configurações">
              <h2>Configurações</h2>
              <div className="settings-row">
                <span>Conta</span>
                <strong>{user?.email || '—'}</strong>
              </div>
              <div className="settings-row">
                <span>Minutos restantes no mês</span>
                <strong>{usage ? `${Math.round(usage.minutesRemaining)} de ${usage.minutesLimit}` : '—'}</strong>
              </div>
              <div className="settings-row">
                <span>Painel do plano de estudos</span>
                <button className="settings-btn" onClick={() => setPlanOpen((v) => !v)}>
                  {planOpen ? 'Recolher' : 'Mostrar'}
                </button>
              </div>
              <div className="settings-row">
                <span>Câmera</span>
                <button className="settings-btn" onClick={cameraOn ? stopCamera : startCamera}>
                  {cameraOn ? 'Desligar' : 'Ligar'}
                </button>
              </div>
              <div className="settings-actions">
                <button className="settings-btn danger" onClick={handleSignOut}>Sair da conta</button>
                <button className="settings-btn" onClick={() => setSettingsOpen(false)}>Fechar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0b131a',
  },
  teacherVideoImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  studentPipPreviewImg: {
    width: '100%',
    height: '100%',
  },
});
