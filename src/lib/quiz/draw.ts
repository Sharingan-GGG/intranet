// RANDOM QUESTION SETS: pure functions, no I/O. Unit-tested in draw.test.ts.
//
// A quiz with a `draw` rule (e.g. 10 choice questions + 5 scenarios) gives each ATTEMPT its own
// selection from the bank, in its own order, with answer options and scenario choices shuffled too.
// So colleagues sitting side by side see different questions, in a different order, with the
// right answer under a different letter.
//
// DETERMINISTIC, NOT STORED
//   The selection comes from a "draw key" = user id + quiz version + attempt number. The same key
//   always gives the same selection, so:
//     - refreshing the page shows the SAME questions (no re-rolling until you get easy ones),
//     - the server works the selection out again at submit time and scores exactly those items,
//       so nothing has to be stored and the browser can't choose its own questions,
//     - after a submit the attempt number goes up, so a retake gets a NEW selection.
//   The key isn't secret and doesn't need to be: knowing it only tells you your own questions,
//   which you can see anyway.
//
// FAIR SPREAD
//   Choice questions are picked round-robin across topics (one per topic before any topic gets a
//   second), so every attempt covers the full range. Scenarios are picked at random.

import type { PrivateSimulationQuestion } from './simulation.types';
import { toPublicQuiz } from './scoring';
import type { PrivateQuestion, PublicQuiz, Quiz } from './types';

/** The draw key for one person's Nth attempt (attemptNumber starts at 1). */
export function drawKey(userId: string, quizVersion: string, attemptNumber: number): string {
  return `${quizVersion}|${userId}|${attemptNumber}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeded randomness (same seed → same sequence; NOT for security, just for shuffling)
// ─────────────────────────────────────────────────────────────────────────────

/** FNV-1a: turns any string into a 32-bit number. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, well-mixed generator. Returns numbers in [0, 1). */
export function seededRandom(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle on a COPY (the input is never changed). */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks `count` items spread across topics: shuffle each topic's items and the topic order, then
 * take one from each topic in turn until enough are picked.
 */
function pickSpread<T extends { topic: string }>(items: readonly T[], count: number, random: () => number): T[] {
  const byTopic = new Map<string, T[]>();
  for (const item of items) byTopic.set(item.topic, [...(byTopic.get(item.topic) ?? []), item]);
  const queues = shuffle([...byTopic.values()], random).map((group) => shuffle(group, random));

  const picked: T[] = [];
  while (picked.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) picked.push(next);
      if (picked.length === count) break;
    }
  }
  return picked;
}

// ─────────────────────────────────────────────────────────────────────────────
// The selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The item ids for one attempt, in the order they're shown (and scored).
 * No `draw` rule: every item, in the order written (questions, then scenarios).
 * Counts larger than the bank are capped at the bank size.
 */
export function drawItemIds(quiz: Quiz, key: string): string[] {
  const sims = quiz.simulations ?? [];
  if (!quiz.draw) return [...quiz.questions.map((q) => q.id), ...sims.map((s) => s.id)];

  const random = seededRandom(`${key}|items`);
  const questions = pickSpread(quiz.questions, quiz.draw.questions, random);
  const simulations = shuffle(sims, random).slice(0, quiz.draw.simulations);
  return shuffle([...questions, ...simulations].map((item) => item.id), random);
}

/** Number of items in one attempt (what the score is out of). */
export function itemsPerAttempt(quiz: Quiz): number {
  const sims = quiz.simulations?.length ?? 0;
  if (!quiz.draw) return quiz.questions.length + sims;
  return Math.min(quiz.draw.questions, quiz.questions.length) + Math.min(quiz.draw.simulations, sims);
}

/**
 * The PUBLIC quiz for one attempt: only the drawn items, `order` set, and the display order of
 * choice-question options and scenario actions shuffled (true / false keeps its natural order).
 * Shuffling only changes the ORDER on screen: option and action ids are untouched, and scoring
 * works on ids, so it can't affect anyone's score.
 * Built through toPublicQuiz, so the answer key is stripped exactly as for the full quiz.
 */
export function toPublicDraw(quiz: Quiz, key: string): PublicQuiz {
  const order = drawItemIds(quiz, key);
  const drawn = new Set(order);
  const random = seededRandom(`${key}|display`);

  const questions: PrivateQuestion[] = quiz.questions
    .filter((q) => drawn.has(q.id))
    .map((q) => (q.type === 'truefalse' ? q : { ...q, options: shuffle(q.options, random) }));

  const simulations: PrivateSimulationQuestion[] = (quiz.simulations ?? [])
    .filter((s) => drawn.has(s.id))
    .map((s) => ({ ...s, steps: s.steps.map((step) => ({ ...step, actions: shuffle(step.actions, random) })) }));

  return { ...toPublicQuiz({ ...quiz, questions, simulations }), order };
}
