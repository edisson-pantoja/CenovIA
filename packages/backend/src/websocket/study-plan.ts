/**
 * Plano de estudos da aula: lista fixa de tópicos controlada pela ferramenta `study_plan`.
 * O estado vive no relay (sobrevive a reconexões do Gemini) e é espelhado para o painel lateral.
 */

import type { StudyPlanState, StudyTopic } from '@cenovia/shared';

export const emptyStudyPlan = (): StudyPlanState => ({
  theme: '',
  topics: [],
  currentTopicId: null,
  confirmed: false,
});

const slug = (i: number) => `t${i + 1}`;

/** Resolve um tópico por id ("t2"), posição (1-based) ou título parcial */
function findTopic(plan: StudyPlanState, ref: unknown): StudyTopic | undefined {
  if (ref === undefined || ref === null) return undefined;
  const s = String(ref).trim().toLowerCase();
  return (
    plan.topics.find((t) => t.id.toLowerCase() === s) ||
    plan.topics[Number(s) - 1] ||
    plan.topics.find((t) => t.title.toLowerCase().includes(s))
  );
}

/** Aplica uma chamada da ferramenta study_plan e devolve o novo estado + resultado para o modelo */
export function applyStudyPlanCall(
  plan: StudyPlanState,
  args: any,
): { plan: StudyPlanState; result: Record<string, unknown> } {
  const action = String(args?.action || '');
  const next: StudyPlanState = { ...plan, topics: plan.topics.map((t) => ({ ...t })) };

  switch (action) {
    case 'create': {
      const titles: string[] = Array.isArray(args.topics)
        ? args.topics.map((t: unknown) => String(t)).filter(Boolean)
        : [];
      if (titles.length === 0) return { plan, result: { error: 'topics vazio' } };
      next.theme = String(args.theme || next.theme || '');
      next.topics = titles.map((title, i) => ({ id: slug(i), title, done: false }));
      next.currentTopicId = next.topics[0].id;
      next.confirmed = false;
      break;
    }
    case 'confirm':
      next.confirmed = true;
      break;
    case 'set_current': {
      const t = findTopic(next, args.topic);
      if (!t) return { plan, result: { error: 'tópico não encontrado' } };
      next.currentTopicId = t.id;
      break;
    }
    case 'complete': {
      const t = findTopic(next, args.topic) || findTopic(next, next.currentTopicId);
      if (!t) return { plan, result: { error: 'tópico não encontrado' } };
      t.done = true;
      const pending = next.topics.find((x) => !x.done);
      next.currentTopicId = pending ? pending.id : null;
      break;
    }
    case 'remove': {
      const t = findTopic(next, args.topic);
      if (!t) return { plan, result: { error: 'tópico não encontrado' } };
      next.topics = next.topics.filter((x) => x.id !== t.id);
      if (next.currentTopicId === t.id) {
        const pending = next.topics.find((x) => !x.done);
        next.currentTopicId = pending ? pending.id : null;
      }
      break;
    }
    case 'add': {
      const title = String(args.title || '').trim();
      if (!title) return { plan, result: { error: 'title vazio' } };
      let n = next.topics.length;
      while (next.topics.some((x) => x.id === slug(n))) n++;
      next.topics.push({ id: slug(n), title, done: false });
      if (!next.currentTopicId) next.currentTopicId = slug(n);
      break;
    }
    default:
      return { plan, result: { error: `ação desconhecida: ${action}` } };
  }

  return { plan: next, result: { ok: true, plan: next } };
}

/** Texto para reinjetar o plano no prompt (ex.: reconexão) */
export function describeStudyPlan(plan: StudyPlanState): string {
  if (plan.topics.length === 0) return '';
  const lines = plan.topics.map(
    (t) => `- [${t.done ? 'x' : ' '}] ${t.id}: ${t.title}${t.id === plan.currentTopicId ? '  <-- TÓPICO ATUAL' : ''}`,
  );
  return `\nPLANO DE ESTUDOS ATUAL (tema: ${plan.theme || 'n/d'}; confirmado pelo aluno: ${plan.confirmed ? 'sim' : 'não'}):\n${lines.join('\n')}`;
}
