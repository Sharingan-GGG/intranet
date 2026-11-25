import { describe, expect, it } from 'vitest';
import {
  formatScore,
  isCorrect,
  meetsPassMark,
  sanitizeAnswers,
  scoreAttempt,
  toAttemptResult,
  toPublicQuiz,
} from './scoring';
import type { PrivateQuestion, Quiz, StoredAttempt } from './types';
import type { PrivateSimulationQuestion } from './simulation.types';

// Tiny made-up quiz: tests stay stable when the real questions change, and the real bank is
// `server-only`, so it can't be imported here without mocking (see questions.test.ts).

const single: PrivateQuestion = {
  id: 's1',
  topic: 'phishing',
  type: 'single',
  prompt: 'single',
  options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  correct: ['b'],
  explanation: 'secret-explanation',
  policyRef: 'Policy s.1',
};
const multi: PrivateQuestion = {
  id: 'm1',
  topic: 'devices',
  type: 'multi',
  prompt: 'multi',
  options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
  correct: ['a', 'c'],
  explanation: 'm-explanation',
  policyRef: 'Policy s.2',
};
const tf: PrivateQuestion = {
  id: 't1',
  topic: 'software',
  type: 'truefalse',
  prompt: 'tf',
  options: [{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }],
  correct: ['false'],
  explanation: 't-explanation',
  policyRef: 'Policy s.3',
};

/** One-step simulation: "report" is best, "open" is unsafe; needs 1 real flag (h-flag; h-decoy is a decoy). */
const sim: PrivateSimulationQuestion = {
  id: 'sim1',
  topic: 'phishing',
  type: 'simulation',
  title: 'Sim',
  brief: 'Brief',
  start: 'inbox',
  steps: [
    {
      id: 'inbox',
      screen: { kind: 'sms', from: 'Unknown', receivedAt: 'Today', messages: ['Pay now'] },
      hotspots: [{ id: 'h-flag', target: 'from' }, { id: 'h-decoy', target: 'message', index: 0 }],
      actions: [
        { id: 'open', kind: 'click_link', label: 'Open' },
        { id: 'report', kind: 'report', label: 'Report' },
      ],
    },
  ],
  actionResults: {
    open: { verdict: 'unsafe', feedback: 'secret-open' },
    report: { verdict: 'best', feedback: 'secret-report' },
  },
  hotspotResults: {
    'h-flag': { isFlag: true, explanation: 'secret-flag' },
    'h-decoy': { isFlag: false, explanation: 'secret-decoy' },
  },
  minFlags: 1,
  explanation: 'sim-explanation',
  policyRef: 'Policy s.11',
};

const quiz: Quiz = { version: 'test.1', title: 'Test', passMark: 0.8, questions: [single, multi, tf] };
const mixedQuiz: Quiz = { ...quiz, simulations: [sim] }; // 3 choice + 1 simulation = 4 items

describe('isCorrect', () => {
  it('single / truefalse: matches the one correct option', () => {
    expect(isCorrect(single, ['b'])).toBe(true);
    expect(isCorrect(single, ['a'])).toBe(false);
    expect(isCorrect(tf, ['false'])).toBe(true);
    expect(isCorrect(tf, ['true'])).toBe(false);
  });
  it('unanswered is wrong', () => {
    expect(isCorrect(single, undefined)).toBe(false);
    expect(isCorrect(single, [])).toBe(false);
  });
  it('multi: needs the exact set, any order', () => {
    expect(isCorrect(multi, ['c', 'a'])).toBe(true);
    expect(isCorrect(multi, ['a'])).toBe(false);           // partial
    expect(isCorrect(multi, ['a', 'b', 'c'])).toBe(false); // over-selected
  });
  it('duplicates can’t fake a match', () => {
    expect(isCorrect(multi, ['a', 'a'])).toBe(false);
  });
});

describe('meetsPassMark', () => {
  it('passes exactly at the mark despite floating point', () => {
    expect(meetsPassMark(4, 5, 0.8)).toBe(true);   // exactly 80%
    expect(meetsPassMark(7, 10, 0.7)).toBe(true);  // 0.7 * 10 = 7.000000000000001
    expect(meetsPassMark(3, 5, 0.8)).toBe(false);
  });
  it('15 questions at 80% needs 12', () => {
    expect(meetsPassMark(12, 15, 0.8)).toBe(true);
    expect(meetsPassMark(11, 15, 0.8)).toBe(false);
  });
  it('an empty quiz can’t be passed', () => {
    expect(meetsPassMark(0, 0, 0.8)).toBe(false);
  });
});

describe('scoreAttempt', () => {
  it('all correct passes with score 1', () => {
    expect(scoreAttempt(quiz, { s1: ['b'], m1: ['a', 'c'], t1: ['false'] })).toMatchObject({
      correctCount: 3,
      total: 3,
      score: 1,
      passed: true,
    });
  });
  it('below pass mark fails; score is a fraction', () => {
    const r = scoreAttempt(quiz, { s1: ['b'], m1: ['a'], t1: ['false'] });
    expect(r).toMatchObject({ correctCount: 2, passed: false });
    expect(r.score).toBeCloseTo(2 / 3);
    expect(r.perQuestion).toEqual([
      { questionId: 's1', correct: true },
      { questionId: 'm1', correct: false },
      { questionId: 't1', correct: true },
    ]);
  });
  it('empty quiz scores 0 without dividing by zero', () => {
    expect(scoreAttempt({ ...quiz, questions: [] }, {})).toMatchObject({ total: 0, score: 0, passed: false });
  });
});

describe('scoreAttempt with simulations', () => {
  const allChoiceRight = { s1: ['b'], m1: ['a', 'c'], t1: ['false'] };

  it('a simulation counts as one question, listed after the choice questions', () => {
    const r = scoreAttempt(mixedQuiz, { ...allChoiceRight, sim1: ['report', 'h-flag'] });
    expect(r).toMatchObject({ correctCount: 4, total: 4, score: 1, passed: true });
    expect(r.perQuestion[3]).toEqual({ questionId: 'sim1', correct: true });
  });
  it('an unsafe action makes the simulation wrong (3/4 = 75% < 80% → fail)', () => {
    expect(scoreAttempt(mixedQuiz, { ...allChoiceRight, sim1: ['open', 'h-flag'] })).toMatchObject({
      correctCount: 3,
      total: 4,
      passed: false,
    });
  });
  it('right action but no real flag found → wrong', () => {
    expect(scoreAttempt(mixedQuiz, { ...allChoiceRight, sim1: ['report', 'h-decoy'] }).correctCount).toBe(3);
    expect(scoreAttempt(mixedQuiz, { ...allChoiceRight, sim1: ['report'] }).correctCount).toBe(3);
  });
  it('a skipped simulation is wrong', () => {
    expect(scoreAttempt(mixedQuiz, allChoiceRight).correctCount).toBe(3);
  });
});

describe('sanitizeAnswers', () => {
  it('accepts valid answers and dedupes', () => {
    expect(sanitizeAnswers(quiz, { s1: ['b'], m1: ['a', 'a', 'c'] })).toEqual({
      ok: true,
      answers: { s1: ['b'], m1: ['a', 'c'] },
    });
  });
  it('rejects unknown questions, unknown options, and multiple picks on single / truefalse', () => {
    const r = sanitizeAnswers(quiz, { nope: ['a'], s1: ['a', 'b'], m1: ['z'], t1: ['true', 'false'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(4);
  });
  it('passes simulation answers through the simulation sanitizer', () => {
    expect(sanitizeAnswers(mixedQuiz, { sim1: ['h-flag', 'report', 'h-flag'] })).toEqual({
      ok: true,
      answers: { sim1: ['report', 'h-flag'] },
    });
  });
  it('rejects bad simulation answers', () => {
    expect(sanitizeAnswers(mixedQuiz, { sim1: ['report', 'not-a-real-id'] }).ok).toBe(false); // unknown id
    expect(sanitizeAnswers(mixedQuiz, { sim1: ['report', 'open'] }).ok).toBe(false);          // click after the end
  });
});

describe('toAttemptResult', () => {
  it('attaches explanation and policyRef to every item, including simulations', () => {
    const stored: StoredAttempt = {
      id: 'att-123456',
      quizVersion: 'test.1',
      userId: 'u',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      answers: {},
      ...scoreAttempt(mixedQuiz, { s1: ['b'] }),
    };
    const r = toAttemptResult(stored, mixedQuiz);
    expect(r).toMatchObject({
      attemptId: 'att-123456',
      quizVersion: 'test.1',
      correctCount: 1,
      total: 4,
      completedAt: '2026-01-01T00:05:00.000Z',
    });
    expect(r.feedback[1]).toEqual({ questionId: 'm1', correct: false, explanation: 'm-explanation', policyRef: 'Policy s.2' });
    // Unplayed scenario: only the first screen counts as seen (1 real flag on it), none spotted.
    expect(r.feedback[3]).toEqual({
      questionId: 'sim1',
      correct: false,
      explanation: 'sim-explanation',
      policyRef: 'Policy s.11',
      flags: { found: 0, total: 1 },
      // Not played: nothing chosen; the one real flag on the screen they'd have seen is "missed".
      review: {
        reason: 'incomplete',
        genuine: false,
        choices: [],
        flags: [{ hotspotId: 'h-flag', isFlag: true, marked: false, explanation: 'secret-flag' }],
      },
    });
    expect(r.feedback[0]).not.toHaveProperty('flags'); // choice questions have no flag count
  });

  // Changed Nov 2026: AFTER submitting, the result explains each red flag and choice (that's when it
  // teaches). Before submitting, the browser still gets no answer key at all (see toPublicQuiz below).
  it('scenarios explain each choice, each red flag and each false alarm on the screens seen', () => {
    const answers = { s1: ['b'], m1: ['a', 'c'], tf1: ['false'], sim1: ['report', 'h-flag', 'h-decoy'] };
    const stored: StoredAttempt = {
      id: 'att-654321',
      quizVersion: 'test.1',
      userId: 'u',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      answers,
      ...scoreAttempt(mixedQuiz, answers),
    };
    const r = toAttemptResult(stored, mixedQuiz);
    expect(r.feedback[3].flags).toEqual({ found: 1, total: 1 }); // the decoy doesn't count as found
    expect(r.feedback[3].correct).toBe(true); // ONE false alarm is forgiven on a message with real flags
    expect(r.feedback[3].review).toEqual({
      genuine: false,
      choices: [{ actionId: 'report', verdict: 'best', feedback: 'secret-report' }],
      flags: [
        { hotspotId: 'h-flag', isFlag: true, marked: true, explanation: 'secret-flag' },
        { hotspotId: 'h-decoy', isFlag: false, marked: true, explanation: 'secret-decoy' },
      ],
    });
    // Actions they never took aren't explained.
    expect(JSON.stringify(r)).not.toContain('secret-open');
  });
});

describe('toPublicQuiz', () => {
  it('strips answers, explanations and policy refs from choice questions', () => {
    const json = JSON.stringify(toPublicQuiz(quiz));
    expect(json).not.toContain('correct');
    expect(json).not.toContain('explanation');
    expect(json).not.toContain('policyRef');
    expect(json).toContain('"passMark":0.8');
  });
  it('strips the answer key from simulations too', () => {
    const json = JSON.stringify(toPublicQuiz(mixedQuiz));
    expect(json).not.toContain('secret-');
    expect(json).not.toContain('actionResults');
    expect(json).not.toContain('hotspotResults');
    expect(json).not.toContain('minFlags'); // private since Nov 2026: "find N" gave answers away (0 = genuine)
    expect(json).not.toContain('explanation');
    expect(json).toContain('"id":"sim1"'); // the simulation itself is still sent
  });
});

describe('formatScore', () => {
  it('rounds to a whole percent', () => {
    expect(formatScore(0.8333)).toBe('83%');
    expect(formatScore(1)).toBe('100%');
  });
});
