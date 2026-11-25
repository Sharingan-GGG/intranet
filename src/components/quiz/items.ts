// A quiz has two kinds of item: choice questions and interactive scenarios (simulations).
// The screens treat them as ONE list, in the same order the server scores them
// (choice questions first, then scenarios). These helpers keep that logic in one place.

import type { SimulationQuestion } from '../../lib/quiz/simulation.types';
import { optionLetter, type PublicQuestion, type PublicQuiz } from '../../lib/quiz/types';
import { cleanPicks, isSimulationFinished, toPlayState, walk } from './simulation/play';

export type QuizItem =
  | { kind: 'question'; id: string; question: PublicQuestion }
  | { kind: 'simulation'; id: string; sim: SimulationQuestion };

/**
 * Every item, in the order to show it: `quiz.order` when the server drew a random selection
 * (questions and scenarios mixed), otherwise choice questions then scenarios.
 */
export function quizItems(quiz: PublicQuiz): QuizItem[] {
  const all: QuizItem[] = [
    ...quiz.questions.map((question) => ({ kind: 'question' as const, id: question.id, question })),
    ...(quiz.simulations ?? []).map((sim) => ({ kind: 'simulation' as const, id: sim.id, sim })),
  ];
  if (!quiz.order) return all;
  const byId = new Map(all.map((item) => [item.id, item]));
  return quiz.order.flatMap((id) => byId.get(id) ?? []);
}

/**
 * Done = ready to submit. A choice question needs at least one option picked.
 * A scenario must be played to an ending: the server would accept a half-played one,
 * but it would always score as wrong, so the screens ask people to finish it.
 */
export function isItemDone(item: QuizItem, answers: Record<string, string[]>): boolean {
  const picks = answers[item.id];
  return item.kind === 'question' ? (picks?.length ?? 0) > 0 : isSimulationFinished(item.sim, picks);
}

/** Short title for lists (review / result screens). */
export function itemTitle(item: QuizItem): string {
  return item.kind === 'question' ? item.question.prompt : item.sim.title;
}

/** "B. Report it" / "Check → Report it · 2 red flags marked" / "" when nothing chosen. */
export function describeAnswer(item: QuizItem, picks: readonly string[] = [], { includeFlags = true } = {}): string {
  if (item.kind === 'question') {
    return item.question.options
      .map((o, i) => (picks.includes(o.id) ? (item.question.type === 'single' ? `${optionLetter(i)}. ${o.label}` : o.label) : null))
      .filter(Boolean)
      .join('; ');
  }
  const { path, tapped } = toPlayState(item.sim, picks);
  const { choices } = walk(item.sim, path);
  if (!includeFlags) return choices.join(' → ');
  if (!choices.length && !tapped.length) return '';
  const flags = `${tapped.length} red flag${tapped.length === 1 ? '' : 's'} marked`;
  return choices.length ? `${choices.join(' → ')} · ${flags}` : flags;
}

/**
 * The answers to send: only items in this quiz, nothing empty, and scenario answers cleaned so
 * stale saved data can't make the server reject the whole submission.
 */
export function answersForSubmit(items: QuizItem[], answers: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const item of items) {
    const picks = item.kind === 'simulation' ? cleanPicks(item.sim, answers[item.id]) : (answers[item.id] ?? []);
    if (picks.length) out[item.id] = picks;
  }
  return out;
}
