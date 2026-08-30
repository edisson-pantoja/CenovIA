/**
 * OnboardingScreen — Seleção de nível, série e matéria (3 etapas)
 *
 * Etapa 1: Nível (Fundamental / Médio / Superior)
 * Etapa 2: Série (chips) ou Curso (texto livre para Superior)
 * Etapa 3: Matéria (lista BNCC para Fund/Médio ou texto livre para Superior)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { COLORS } from '../../lib/constants';
import type { EducationLevel, StudyContext } from '@cenovia/shared';

// ── Dados curriculares inline (MVP) ──────────────────────────────────────────

const FUNDAMENTAL_GRADES = [
  '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
  '6º Ano', '7º Ano', '8º Ano', '9º Ano',
];

const MEDIO_GRADES = ['1ª Série', '2ª Série', '3ª Série'];

const SUBJECTS_FUNDAMENTAL = [
  'Língua Portuguesa', 'Matemática', 'Ciências', 'História',
  'Geografia', 'Arte', 'Educação Física', 'Inglês', 'Ensino Religioso',
];

const SUBJECTS_MEDIO = [
  'Língua Portuguesa', 'Matemática', 'Física', 'Química', 'Biologia',
  'História', 'Geografia', 'Inglês', 'Filosofia', 'Sociologia',
  'Arte', 'Educação Física', 'Espanhol', 'Redação',
];

// ─────────────────────────────────────────────────────────────────────────────

interface StepIndicatorProps {
  current: number;
  total: number;
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[stepStyles.dot, i + 1 === current && stepStyles.activeDot, i + 1 < current && stepStyles.doneDot]}
        />
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeDot: { backgroundColor: COLORS.GOLD, width: 24, borderRadius: 4 },
  doneDot: { backgroundColor: COLORS.SUCCESS },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<EducationLevel | null>(null);
  const [gradeId, setGradeId] = useState('');
  const [gradeLabel, setGradeLabel] = useState('');
  const [course, setCourse] = useState('');   // Superior
  const [subjectName, setSubjectName] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const { setStudyContext } = useSession();
  const router = useRouter();

  const grades = level === 'fundamental' ? FUNDAMENTAL_GRADES : level === 'medio' ? MEDIO_GRADES : [];
  const subjects = level === 'fundamental' ? SUBJECTS_FUNDAMENTAL : level === 'medio' ? SUBJECTS_MEDIO : [];

  const handleLevelSelect = (l: EducationLevel) => {
    setLevel(l);
    setGradeId('');
    setGradeLabel('');
    setSubjectName('');
    setStep(2);
  };

  const handleGradeSelect = (g: string) => {
    setGradeId(g.toLowerCase().replace(/\s/g, '_'));
    setGradeLabel(g);
  };

  const handleSubjectSelect = (s: string) => {
    if (s === '__custom__') {
      setShowCustomInput(true);
      setSubjectName('');
    } else {
      setShowCustomInput(false);
      setSubjectName(s);
    }
  };

  const canProceedStep2 = level === 'superior' ? course.trim().length > 0 : gradeLabel.length > 0;
  const canProceedStep3 = showCustomInput ? customSubject.trim().length > 0 : subjectName.length > 0;

  const handleFinish = () => {
    if (!level) return;

    const effectiveSubject = showCustomInput ? customSubject.trim() : subjectName;
    const effectiveGradeLabel = level === 'superior'
      ? `Ensino Superior — ${course.trim()}`
      : `${gradeLabel} (Ensino ${level === 'fundamental' ? 'Fundamental' : 'Médio'})`;

    const ctx: StudyContext = {
      level,
      gradeId: level !== 'superior' ? gradeId : undefined,
      gradeLabel: effectiveGradeLabel,
      course: level === 'superior' ? course.trim() : undefined,
      subjectName: effectiveSubject,
    };

    setStudyContext(ctx);
    router.replace('/(session)/classroom');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Cabeçalho */}
        <View style={styles.header}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Voltar</Text>
            </TouchableOpacity>
          )}
          <StepIndicator current={step} total={3} />
        </View>

        {/* ── Etapa 1: Nível ─────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>Qual é o seu nível de ensino?</Text>
            <Text style={styles.subline}>A professora vai adaptar a linguagem e o conteúdo pra você 😊</Text>

            <TouchableOpacity style={styles.levelCard} onPress={() => handleLevelSelect('fundamental')}>
              <Text style={styles.levelEmoji}>📚</Text>
              <View>
                <Text style={styles.levelTitle}>Ensino Fundamental</Text>
                <Text style={styles.levelSub}>1º ao 9º Ano</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.levelCard} onPress={() => handleLevelSelect('medio')}>
              <Text style={styles.levelEmoji}>🎓</Text>
              <View>
                <Text style={styles.levelTitle}>Ensino Médio</Text>
                <Text style={styles.levelSub}>1ª a 3ª Série</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.levelCard} onPress={() => handleLevelSelect('superior')}>
              <Text style={styles.levelEmoji}>🏛️</Text>
              <View>
                <Text style={styles.levelTitle}>Ensino Superior</Text>
                <Text style={styles.levelSub}>Graduação e Pós-graduação</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Etapa 2: Série ou Curso ────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>
              {level === 'superior' ? 'Qual é o seu curso?' : 'Qual é a sua série?'}
            </Text>

            {level === 'superior' ? (
              <TextInput
                style={styles.input}
                placeholder="Ex: Engenharia Civil, Medicina, Direito..."
                placeholderTextColor={COLORS.TEXT_SECONDARY}
                value={course}
                onChangeText={setCourse}
                autoFocus
              />
            ) : (
              <View style={styles.chipGrid}>
                {grades.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, gradeLabel === g && styles.chipActive]}
                    onPress={() => handleGradeSelect(g)}
                  >
                    <Text style={[styles.chipText, gradeLabel === g && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep2 && styles.nextBtnDisabled]}
              onPress={() => setStep(3)}
              disabled={!canProceedStep2}
            >
              <Text style={styles.nextBtnText}>Próximo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Etapa 3: Matéria ───────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>
              {level === 'superior' ? 'Qual matéria vamos estudar?' : 'Qual matéria você precisa de ajuda?'}
            </Text>

            {level === 'superior' ? (
              <TextInput
                style={styles.input}
                placeholder="Ex: Cálculo I, Anatomia, Direito Civil..."
                placeholderTextColor={COLORS.TEXT_SECONDARY}
                value={subjectName}
                onChangeText={setSubjectName}
                autoFocus
              />
            ) : (
              <>
                <View style={styles.chipGrid}>
                  {subjects.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, subjectName === s && !showCustomInput && styles.chipActive]}
                      onPress={() => handleSubjectSelect(s)}
                    >
                      <Text style={[styles.chipText, subjectName === s && !showCustomInput && styles.chipTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {/* Opção livre */}
                  <TouchableOpacity
                    style={[styles.chip, showCustomInput && styles.chipActive]}
                    onPress={() => handleSubjectSelect('__custom__')}
                  >
                    <Text style={[styles.chipText, showCustomInput && styles.chipTextActive]}>+ Outra</Text>
                  </TouchableOpacity>
                </View>

                {showCustomInput && (
                  <TextInput
                    style={[styles.input, { marginTop: 12 }]}
                    placeholder="Digite a matéria..."
                    placeholderTextColor={COLORS.TEXT_SECONDARY}
                    value={customSubject}
                    onChangeText={setCustomSubject}
                    autoFocus
                  />
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, !canProceedStep3 && styles.nextBtnDisabled]}
              onPress={handleFinish}
              disabled={!canProceedStep3}
            >
              <Text style={styles.confirmBtnText}>✅ Entrar na Aula</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  content: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 },
  backBtn: { padding: 4 },
  backBtnText: { color: COLORS.TEXT_SECONDARY, fontSize: 15 },

  stepContainer: { gap: 20 },
  headline: { color: COLORS.TEXT_PRIMARY, fontSize: 26, fontWeight: '700', lineHeight: 34 },
  subline: { color: COLORS.TEXT_SECONDARY, fontSize: 15, lineHeight: 22 },

  // Level cards
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#141F2B',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#243040',
  },
  levelEmoji: { fontSize: 36 },
  levelTitle: { color: COLORS.TEXT_PRIMARY, fontSize: 18, fontWeight: '600' },
  levelSub: { color: COLORS.TEXT_SECONDARY, fontSize: 13, marginTop: 2 },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#141F2B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#243040',
  },
  chipActive: { backgroundColor: COLORS.GOLD, borderColor: COLORS.GOLD },
  chipText: { color: COLORS.TEXT_PRIMARY, fontSize: 14 },
  chipTextActive: { color: COLORS.BACKGROUND, fontWeight: '700' },

  // Input
  input: {
    backgroundColor: '#141F2B',
    color: COLORS.TEXT_PRIMARY,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#243040',
  },

  // Buttons
  nextBtn: {
    backgroundColor: COLORS.GOLD,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: COLORS.BACKGROUND, fontSize: 16, fontWeight: '700' },
  confirmBtn: {
    backgroundColor: COLORS.SUCCESS,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
