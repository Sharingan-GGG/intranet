// Pure scoring logic: no I/O, no framework imports. Unit-tested in scoring.test.ts.
//
// Deliberately NOT marked `import 'server-only'`: it holds no secrets itself (the answer key
// lives in the question bank, which IS server-only), and tests need to import it.
//
// A quiz has two kinds of item, and each counts as ONE question in the score:
//   - choice questions (single / multi / truefalse): quiz.questions
//   - interactive simulations: quiz.simulations (rules in simulation-scoring.ts)
// Both use the same answers shape: Record<itemId, string[]>.

import type { AttemptResult, PrivateQuestion, PublicQuiz, Quiz, StoredAttempt } from './types';
import type { PrivateSimulationQuestion } from './simulation.types';
import { toPublicSimulation } from './simulation.types';
import { flagSummary, isSimulationCorrect, reviewSimulation, sanitizeSimulationAnswer } from './simulation-scoring';

type Answers = Record<string, string[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Choice questions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A question is correct only if the selected set EXACTLY equals the correct set.
 * - Multi-select is all-or-nothing: too few or too many ticks = wrong.
 * - Order doesn't matter: ['c', 'a'] matches ['a', 'c'].
 * - Duplicates can't fake it: ['a', 'a'] becomes {a}, size 1, which doesn't match a 2-answer key.
 */
export function isCorrect(question: PrivateQuestion, selected: readonly string[] | undefined): boolean {
  if (!selected || selected.length === 0) return false;        // unanswered = wrong
  const picked = new Set(selected);                             // remove duplicates
  if (picked.size !== question.correct.length) return false;    // too few or too many
  return question.correct.every((id) => picked.has(id));        // every right answer was picked
}

/** single and truefalse accept exactly one option; only multi accepts several. */
export function isSingleSelect(q: Pick<PrivateQuestion, 'type'>): boolean {
  return q.type !== 'multi';
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass mark
// ─────────────────────────────────────────────────────────────────────────────

/**
 * passMark is a fraction (0.8 = 80%).
 * We compare COUNTS, not percentages, so floating point can't fail an exact pass:
 *   needed = ceil(passMark × total), e.g. 15 questions × 0.8 = 12 → need 12 correct.
 * The `- 1e-9` absorbs float noise: 0.7 × 10 = 7.000000000000001, and ceil would give 8 without it.
 * An empty quiz can never be passed.
 */
export function meetsPassMark(correctCount: number, total: number, passMark: number): boolean {
  if (total === 0) return false;
  return correctCount >= Math.ceil(passMark * total - 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────────
// Whole attempt
// ─────────────────────────────────────────────────────────────────────────────

/** Reuses StoredAttempt's field types, so a Score can be spread straight into a saved attempt. */
export type Score = Pick<StoredAttempt, 'correctCount' | 'total' | 'score' | 'passed' | 'perQuestion'>;

/** Small helper so a missing `simulations` list behaves like an empty one. */
function simulationsOf(quiz: Quiz): PrivateSimulationQuestion[] {
  return quiz.simulations ?? [];
}

/**
 * Scores an attempt.
 * `itemIds`: the items this attempt was given, in the order shown (a random selection, see draw.ts).
 * Only those count, and perQuestion follows that order. Omitted = every item in the quiz, in the
 * order written (choice questions, then simulations). Ids not in the quiz are ignored.
 */
export function scoreAttempt(quiz: Quiz, answers: Answers, itemIds?: readonly string[]): Score {
  const questionsById = new Map(quiz.questions.map((q) => [q.id, q]));
  const simulationsById = new Map(simulationsOf(quiz).map((s) => [s.id, s]));
  const ids = itemIds ?? [...questionsById.keys(), ...simulationsById.keys()];

  // One entry per item.
  const perQuestion = ids.flatMap((id) => {
    const q = questionsById.get(id);
    if (q) return [{ questionId: id, correct: isCorrect(q, answers[id]) }];
    const s = simulationsById.get(id);
    if (s) return [{ questionId: id, correct: isSimulationCorrect(s, answers[id]) }];
    return [];
  });
  const total = perQuestion.length;
  const correctCount = perQuestion.filter((p) => p.correct).length;
  return {
    correctCount,
    total,
    score: total ? correctCount / total : 0, // guard: never divide by zero
    passed: meetsPassMark(correctCount, total, quiz.passMark),
    perQuestion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Never trust the browser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates every submitted answer before scoring.
 * Choice questions: the question must exist, every option id must exist, single/truefalse must have
 *   at most one pick. Duplicates are removed.
 * Simulations: delegated to sanitizeSimulationAnswer (unknown ids, impossible paths, unseen hotspots).
 * Unanswered items are fine: they're simply missing from `raw` and score as wrong.
 *
 * Returns a "result object": either { ok: true, answers } (cleaned) or { ok: false, errors },
 * so the caller is forced to handle both cases.
 */
export function sanitizeAnswers(
  quiz: Quiz,
  raw: Answers,
): { ok: true; answers: Answers } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const questionsById = new Map(quiz.questions.map((q) => [q.id, q]));
  const simulationsById = new Map(simulationsOf(quiz).map((s) => [s.id, s]));
  const answers: Answers = {};

  for (const [id, picks] of Object.entries(raw)) {
    // Choice question?
    const q = questionsById.get(id);
    if (q) {
      const valid = new Set(q.options.map((o) => o.id));
      const unique = [...new Set(picks)];
      const bad = unique.filter((p) => !valid.has(p));
      if (bad.length) errors.push(`Unknown option(s) ${bad.join(', ')} for question "${id}"`);
      if (isSingleSelect(q) && unique.length > 1) errors.push(`Question "${id}" accepts one answer`);
      answers[id] = unique.filter((p) => valid.has(p));
      continue;
    }

    // Simulation?
    const sim = simulationsById.get(id);
    if (sim) {
      const r = sanitizeSimulationAnswer(sim, picks);
      if (r.ok) answers[id] = r.picks;
      else errors.push(...r.errors);
      continue;
    }

    // Neither: someone sent an id that isn't in this quiz.
    errors.push(`Unknown question "${id}"`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, answers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shapes for the API / browser
// ─────────────────────────────────────────────────────────────────────────────

/** Builds the API result shape (with per-question explanations) from a stored attempt. */
export function toAttemptResult(attempt: StoredAttempt, quiz: Quiz): AttemptResult {
  // One lookup covering both kinds of item. Both have `explanation` and optional `policyRef`.
  const byId = new Map<string, { explanation: string; policyRef?: string }>([
    ...quiz.questions.map((q) => [q.id, q] as const),
    ...simulationsOf(quiz).map((s) => [s.id, s] as const),
  ]);
  const simsById = new Map(simulationsOf(quiz).map((s) => [s.id, s]));
  return {
    attemptId: attempt.id,
    quizVersion: attempt.quizVersion,
    score: attempt.score,
    correctCount: attempt.correctCount,
    total: attempt.total,
    passed: attempt.passed,
    // Only completed attempts are scored, so completedAt should always be set.
    // The '' fallback only satisfies the type (StoredAttempt.completedAt is optional).
    completedAt: attempt.completedAt ?? '',
    feedback: attempt.perQuestion.map(({ questionId, correct }) => {
      const sim = simsById.get(questionId);
      return {
        questionId,
        correct,
        explanation: byId.get(questionId)?.explanation ?? '',
        policyRef: byId.get(questionId)?.policyRef ?? '',
        // Scenarios: flag counts + the full review (each choice, each red flag spotted or missed,
        // false alarms), built from the answer key for the screens THIS person saw. Shown after
        // submitting only: that's when it teaches rather than gives answers away.
        ...(sim
          ? { flags: flagSummary(sim, attempt.answers[questionId]), review: reviewSimulation(sim, attempt.answers[questionId]) }
          : {}),
      };
    }),
  };
}

/**
 * THE SECURITY-CRITICAL FUNCTION: builds the version of the quiz that is safe for the browser.
 * Allow-list, not deny-list: it copies only the named fields, so `correct`, `explanation`,
 * `policyRef` (and anything added to the private types later) are left behind by default.
 * Simulations go through toPublicSimulation, which is an allow-list too.
 */
export function toPublicQuiz(quiz: Quiz): PublicQuiz {
  return {
    version: quiz.version,
    title: quiz.title,
    passMark: quiz.passMark,
    questions: quiz.questions.map(({ id, topic, type, prompt, options, imageUrl }) => ({
      id,
      topic,
      type,
      prompt,
      options,
      ...(imageUrl ? { imageUrl } : {}), // only include imageUrl when there is one
    })),
    simulations: simulationsOf(quiz).map(toPublicSimulation),
  };
}

/** 0.8333 → "83%". */
export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}
