/**
 * OnboardingScreen — Perfil do aluno + nível, ano e matéria (4 etapas)
 *
 * Etapa 1: Nome e gênero do aluno (lembrados neste dispositivo)
 * Etapa 2: Nível (Fundamental / Médio / Superior)
 * Etapa 3: Ano/Série com idade ideal do MEC (ou Curso, no Superior)
 * Etapa 4: Matéria obrigatória da BNCC para o ano (ou "Outra", digitada) + tema opcional da aula
 */

import React, { useEffect, useState } from 'react';
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
import {
  SCHOOL_GRADES,
  getGrade,
  getSubjectsForGrade,
  getThemes,
  type EducationLevel,
  type StudentGender,
  type StudyContext,
} from '@cenovia/shared';

const PROFILE_STORAGE_KEY = 'cenovia.studentProfile';
const TOTAL_STEPS = 4;

function loadSavedProfile(): { name: string; gender: StudentGender | null } {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          name: typeof parsed.name === 'string' ? parsed.name : '',
          gender: parsed.gender === 'feminino' || parsed.gender === 'masculino' ? parsed.gender : null,
        };
      }
    }
  } catch { /* ignora */ }
  return { name: '', gender: null };
}

function saveProfile(name: string, gender: StudentGender) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name, gender }));
    }
  } catch { /* ignora */ }
}

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

  // Perfil do aluno
  const [studentName, setStudentName] = useState('');
  const [studentGender, setStudentGender] = useState<StudentGender | null>(null);

  // Escolaridade
  const [level, setLevel] = useState<EducationLevel | null>(null);
  const [gradeId, setGradeId] = useState('');
  const [course, setCourse] = useState('');   // Superior

  // Matéria e tema
  const [subjectName, setSubjectName] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [focusTheme, setFocusTheme] = useState<string | null>(null);

  const { setStudyContext } = useSession();
  const router = useRouter();

  useEffect(() => {
    const saved = loadSavedProfile();
    if (saved.name) setStudentName(saved.name);
    if (saved.gender) setStudentGender(saved.gender);
  }, []);

  const grade = getGrade(gradeId);
  const grades = level ? SCHOOL_GRADES.filter((g) => g.level === level) : [];
  const subjects = getSubjectsForGrade(gradeId);
  const themes = !showCustomInput && subjectName ? getThemes(subjectName, gradeId) : [];
  const isYoungChild = !!grade && grade.idealAge <= 7;
  const firstName = studentName.trim().split(' ')[0];
  const isGirl = studentGender === 'feminino';

  const handleLevelSelect = (l: EducationLevel) => {
    setLevel(l);
    setGradeId('');
    setSubjectName('');
    setFocusTheme(null);
    setShowCustomInput(false);
    setStep(3);
  };

  const handleGradeSelect = (id: string) => {
    setGradeId(id);
    // A grade de matérias muda entre etapas (ex.: Inglês a partir do 6º ano)
    setSubjectName('');
    setFocusTheme(null);
    setShowCustomInput(false);
  };

  const handleSubjectSelect = (s: string) => {
    setFocusTheme(null);
    if (s === '__custom__') {
      setShowCustomInput(true);
      setSubjectName('');
    } else {
      setShowCustomInput(false);
      setSubjectName(s);
    }
  };

  const canProceedStep1 = studentName.trim().length >= 2 && !!studentGender;
  const canProceedStep3 = level === 'superior' ? course.trim().length > 0 : !!grade;
  const canFinish = showCustomInput ? customSubject.trim().length > 0 : subjectName.trim().length > 0;

  const handleProfileNext = () => {
    if (!canProceedStep1 || !studentGender) return;
    saveProfile(studentName.trim(), studentGender);
    setStep(2);
  };

  const handleFinish = () => {
    if (!level || !studentGender) return;

    const effectiveSubject = showCustomInput ? customSubject.trim() : subjectName.trim();
    const effectiveGradeLabel = level === 'superior'
      ? `Ensino Superior — ${course.trim()}`
      : `${grade?.label} (Ensino ${level === 'fundamental' ? 'Fundamental' : 'Médio'})`;

    const ctx: StudyContext = {
      level,
      gradeId: level !== 'superior' ? gradeId : undefined,
      gradeLabel: effectiveGradeLabel,
      course: level === 'superior' ? course.trim() : undefined,
      subjectName: effectiveSubject,
      isCustomSubject: showCustomInput || level === 'superior',
      focusTheme: focusTheme || undefined,
      studentName: studentName.trim(),
      studentGender,
      studentAge: grade?.idealAge,
    };

    setStudyContext(ctx);
    router.replace('/(session)/classroom');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Cabeçalho */}
        <View style={styles.header}>
          {step > 1 ? (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Voltar</Text>
            </TouchableOpacity>
          ) : <View />}
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </View>

        {/* ── Etapa 1: Perfil do aluno ───────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>Quem vai estudar hoje?</Text>
            <Text style={styles.subline}>
              A Profa. Ana vai chamar o aluno pelo nome e adaptar a conversa 😊
            </Text>

            <Text style={styles.label}>Nome do aluno ou aluna</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Maria, João..."
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              value={studentName}
              onChangeText={(t) => setStudentName(t.slice(0, 40))}
              autoCapitalize="words"
              autoFocus
            />

            <Text style={styles.label}>Gênero</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderCard, studentGender === 'feminino' && styles.genderCardActive]}
                onPress={() => setStudentGender('feminino')}
              >
                <Text style={styles.genderEmoji}>👧</Text>
                <Text style={[styles.genderText, studentGender === 'feminino' && styles.genderTextActive]}>Aluna</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderCard, studentGender === 'masculino' && styles.genderCardActive]}
                onPress={() => setStudentGender('masculino')}
              >
                <Text style={styles.genderEmoji}>👦</Text>
                <Text style={[styles.genderText, studentGender === 'masculino' && styles.genderTextActive]}>Aluno</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep1 && styles.nextBtnDisabled]}
              onPress={handleProfileNext}
              disabled={!canProceedStep1}
            >
              <Text style={styles.nextBtnText}>Próximo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Etapa 2: Nível ─────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>
              {firstName ? `${firstName}, qual é o seu nível de ensino?` : 'Qual é o seu nível de ensino?'}
            </Text>
            <Text style={styles.subline}>A professora vai adaptar a linguagem e o conteúdo pra você 😊</Text>

            <TouchableOpacity style={styles.levelCard} onPress={() => handleLevelSelect('fundamental')}>
              <Text style={styles.levelEmoji}>📚</Text>
              <View>
                <Text style={styles.levelTitle}>Ensino Fundamental</Text>
                <Text style={styles.levelSub}>1º ao 9º Ano · 6 a 14 anos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.levelCard} onPress={() => handleLevelSelect('medio')}>
              <Text style={styles.levelEmoji}>🎓</Text>
              <View>
                <Text style={styles.levelTitle}>Ensino Médio</Text>
                <Text style={styles.levelSub}>1ª a 3ª Série · 15 a 17 anos</Text>
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

        {/* ── Etapa 3: Ano/Série ou Curso ────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>
              {level === 'superior' ? 'Qual é o seu curso?' : `Em que ano ${isGirl ? 'a aluna' : 'o aluno'} está?`}
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
              <>
                <View style={styles.chipGrid}>
                  {grades.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.gradeChip, gradeId === g.id && styles.chipActive]}
                      onPress={() => handleGradeSelect(g.id)}
                    >
                      <Text style={[styles.chipText, gradeId === g.id && styles.chipTextActive]}>{g.label}</Text>
                      <Text style={[styles.gradeAge, gradeId === g.id && styles.chipTextActive]}>{g.idealAge} anos</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isYoungChild && (
                  <View style={styles.parentNotice}>
                    <Text style={styles.parentNoticeTitle}>👨‍👩‍👧 Recomendamos um adulto por perto</Text>
                    <Text style={styles.parentNoticeText}>
                      Nesta idade a criança ainda está aprendendo a ler. A professora vai falar devagar, com frases
                      curtas e brincadeiras, e vai pedir a ajuda do responsável para ler o quadro e acompanhar a aula.
                    </Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep3 && styles.nextBtnDisabled]}
              onPress={() => setStep(4)}
              disabled={!canProceedStep3}
            >
              <Text style={styles.nextBtnText}>Próximo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Etapa 4: Matéria + tema ────────────────────────────── */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.headline}>
              {level === 'superior' ? 'Qual matéria vamos estudar?' : 'Qual matéria vamos estudar hoje?'}
            </Text>
            {grade && (
              <Text style={styles.subline}>Matérias obrigatórias do {grade.label} segundo a BNCC/MEC</Text>
            )}

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
                    style={styles.input}
                    placeholder="Digite a matéria (ex: Redação, Espanhol, Robótica...)"
                    placeholderTextColor={COLORS.TEXT_SECONDARY}
                    value={customSubject}
                    onChangeText={(t) => setCustomSubject(t.slice(0, 60))}
                    autoFocus
                  />
                )}

                {/* Temas e subtemas do ano (BNCC) */}
                {themes.length > 0 && (
                  <View style={styles.themesBox}>
                    <Text style={styles.themesTitle}>O que se estuda de {subjectName} no {grade?.label}</Text>
                    <Text style={styles.themesHint}>Escolha um tema para a aula ou deixe a professora sugerir.</Text>

                    <TouchableOpacity
                      style={[styles.themeCard, focusTheme === null && styles.themeCardActive]}
                      onPress={() => setFocusTheme(null)}
                    >
                      <Text style={styles.themeName}>✨ A professora sugere</Text>
                    </TouchableOpacity>

                    {themes.map((t) => (
                      <TouchableOpacity
                        key={t.tema}
                        style={[styles.themeCard, focusTheme === t.tema && styles.themeCardActive]}
                        onPress={() => setFocusTheme(t.tema)}
                      >
                        <Text style={styles.themeName}>{t.tema}</Text>
                        <Text style={styles.themeSubs}>{t.subtemas.join(' · ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, !canFinish && styles.nextBtnDisabled]}
              onPress={handleFinish}
              disabled={!canFinish}
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
  content: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'android' ? 40 : 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 },
  backBtn: { padding: 4 },
  backBtnText: { color: COLORS.TEXT_SECONDARY, fontSize: 15 },

  stepContainer: { gap: 20 },
  headline: { color: COLORS.TEXT_PRIMARY, fontSize: 26, fontWeight: '700', lineHeight: 34 },
  subline: { color: COLORS.TEXT_SECONDARY, fontSize: 15, lineHeight: 22 },
  label: { color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '600', marginBottom: -10 },

  // Gênero
  genderRow: { flexDirection: 'row', gap: 12 },
  genderCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
    backgroundColor: '#141F2B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#243040',
  },
  genderCardActive: { borderColor: COLORS.GOLD, backgroundColor: 'rgba(212,175,55,0.12)' },
  genderEmoji: { fontSize: 34 },
  genderText: { color: COLORS.TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  genderTextActive: { color: COLORS.GOLD },

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
  gradeChip: {
    minWidth: 92,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#141F2B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#243040',
  },
  gradeAge: { color: COLORS.TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  chipActive: { backgroundColor: COLORS.GOLD, borderColor: COLORS.GOLD },
  chipText: { color: COLORS.TEXT_PRIMARY, fontSize: 14 },
  chipTextActive: { color: COLORS.BACKGROUND, fontWeight: '700' },

  // Aviso para pais
  parentNotice: {
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderColor: 'rgba(96,165,250,0.45)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  parentNoticeTitle: { color: '#93c5fd', fontSize: 15, fontWeight: '700' },
  parentNoticeText: { color: COLORS.TEXT_SECONDARY, fontSize: 14, lineHeight: 20 },

  // Temas BNCC
  themesBox: { gap: 10, marginTop: 4 },
  themesTitle: { color: COLORS.TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  themesHint: { color: COLORS.TEXT_SECONDARY, fontSize: 13, marginTop: -4 },
  themeCard: {
    backgroundColor: '#141F2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#243040',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  themeCardActive: { borderColor: COLORS.GOLD, backgroundColor: 'rgba(212,175,55,0.12)' },
  themeName: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  themeSubs: { color: COLORS.TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },

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
