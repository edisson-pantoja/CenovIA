import {
  getAgeGuidance,
  getGrade,
  getThemes,
  STAGE_LABELS,
  type StudyContext,
} from '@cenovia/shared';

/** Limpa textos digitados pelo usuário antes de colocá-los no prompt (evita quebras e instruções injetadas) */
function sanitize(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t`"<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * Monta a seção do prompt com o perfil do aluno (nome, gênero, idade) e o foco
 * curricular da BNCC para a matéria e o ano escolhidos.
 */
export function buildStudentProfilePrompt(context: Partial<StudyContext> | null | undefined): string {
  if (!context) return '';

  const name = sanitize(context.studentName, 40);
  const firstName = name.split(' ')[0] || '';
  const gender = context.studentGender === 'feminino' || context.studentGender === 'masculino'
    ? context.studentGender
    : undefined;
  const grade = getGrade(context.gradeId);
  const age = grade?.idealAge ?? (typeof context.studentAge === 'number' ? context.studentAge : undefined);
  const subject = sanitize(context.subjectName, 60);
  const focusTheme = sanitize(context.focusTheme, 80);

  const lines: string[] = ['', 'PERFIL DO ALUNO:'];

  // ── Nome e gênero ──
  if (firstName) {
    lines.push(`- Nome: ${name}. Chame pelo primeiro nome ("${firstName}") de forma carinhosa e natural: na saudação, ao elogiar e ao fazer perguntas — mas não em todas as frases.`);
  }
  if (gender === 'feminino') {
    lines.push('- Gênero: FEMININO. É uma aluna. Use sempre a concordância no feminino ("aluna", "querida", "você está atenta", "muito bem, campeã").');
  } else if (gender === 'masculino') {
    lines.push('- Gênero: MASCULINO. É um aluno. Use sempre a concordância no masculino ("aluno", "querido", "você está atento", "muito bem, campeão").');
  } else if (firstName) {
    lines.push('- Gênero não informado: deduza pelo nome; se houver dúvida, use formas neutras ("você", "pessoa estudante").');
  }

  // ── Ano escolar e idade ──
  if (grade) {
    lines.push(`- Ano escolar: ${grade.label} do ${STAGE_LABELS[grade.stage]} — idade ideal pelo MEC: ${grade.idealAge} anos.`);
  } else if (context.level === 'superior') {
    lines.push(`- Ensino Superior${context.course ? ` — curso: ${sanitize(context.course, 60)}` : ''}. Trate como adulto, com linguagem acadêmica.`);
  }

  lines.push('', 'COMO TRATAR ESTE ALUNO (adequação à idade):', getAgeGuidance(age));

  // Segurança com menores de idade
  if (age !== undefined && age < 18) {
    lines.push(
      '- Menor de idade: mantenha todo o conteúdo apropriado para a idade e NUNCA peça dados pessoais (endereço, telefone, nome da escola, senhas). A câmera serve apenas para mostrar o caderno ou exercícios.',
    );
  }

  // ── Foco curricular (BNCC) ──
  const themes = getThemes(context.subjectName || '', context.gradeId);
  if (themes.length > 0) {
    lines.push(
      '',
      `FOCO CURRICULAR — ${subject} no ${grade?.label} (BNCC/MEC). Estes são os temas e subtemas estudados neste ano; use-os como guia:`,
    );
    for (const t of themes) {
      lines.push(`• ${t.tema}: ${t.subtemas.join('; ')}`);
    }
    lines.push(
      '- Mantenha as explicações no nível deste ano. Se o aluno pedir algo de anos posteriores, explique de forma simplificada; se faltar uma base de anos anteriores, revise-a rapidamente antes de seguir.',
      '- Ao montar o plano de estudos (study_plan), use os subtemas acima como referência para os tópicos.',
    );
    if (focusTheme) {
      lines.push(
        `- O aluno escolheu estudar hoje o tema "${focusTheme}". Na saudação, confirme esse tema e já proponha um plano de estudos com os subtemas dele.`,
      );
    } else {
      lines.push(
        '- Na saudação, pergunte o que o aluno quer estudar; se ele não souber, sugira 2 ou 3 temas desta lista.',
      );
    }
  } else if (subject && context.isCustomSubject) {
    lines.push(
      '',
      `FOCO: matéria informada pelo aluno/responsável: "${subject}". Adapte o conteúdo ao ano escolar e à idade acima, seguindo as diretrizes da BNCC quando se aplicarem.`,
    );
  }

  return lines.join('\n');
}
