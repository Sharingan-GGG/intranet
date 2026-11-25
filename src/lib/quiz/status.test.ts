import { describe, expect, it } from 'vitest';
import { buildReport, canViewReport, computeStatus, percentComplete, pickStatus } from './status';
import type { Quiz, QuizOpenEvent, StoredAttempt, User } from './types';

// ─── Fixtures: a one-question quiz and helpers to make records quickly ────────

const quiz: Quiz = {
  version: '2026.1',
  title: 'Test quiz',
  passMark: 0.8,
  questions: [
    {
      id: 'q1',
      topic: 'phishing',
      type: 'single',
      prompt: 'Q',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      correct: ['a'],
      explanation: 'q1-explanation',
    },
  ],
};

let n = 0;
/** Makes a finished attempt. Override any field, e.g. attempt({ passed: true, score: 1 }). */
function attempt(over: Partial<StoredAttempt> = {}): StoredAttempt {
  n += 1;
  return {
    id: `att-${n}`,
    quizVersion: '2026.1',
    userId: 'u1',
    startedAt: '2026-11-01T09:00:00.000Z',
    completedAt: '2026-11-01T09:10:00.000Z',
    answers: {},
    correctCount: 0,
    total: 1,
    score: 0,
    passed: false,
    perQuestion: [{ questionId: 'q1', correct: false }],
    ...over,
  };
}
const pass = (completedAt: string, score = 1, over: Partial<StoredAttempt> = {}) =>
  attempt({ completedAt, score, passed: true, correctCount: 1, perQuestion: [{ questionId: 'q1', correct: true }], ...over });
const fail = (completedAt: string, score = 0, over: Partial<StoredAttempt> = {}) =>
  attempt({ completedAt, score, passed: false, ...over });
const opened = (userId = 'u1', quizVersion = '2026.1'): QuizOpenEvent => ({
  userId,
  quizVersion,
  startedAt: '2026-11-01T08:00:00.000Z',
});

// ─── pickStatus: the decision table ───────────────────────────────────────────

describe('pickStatus', () => {
  it('follows the order completed > failed > in_progress > not_started', () => {
    expect(pickStatus({ hasPassed: true, hasFinished: true, hasOpened: true })).toBe('completed');
    expect(pickStatus({ hasPassed: false, hasFinished: true, hasOpened: true })).toBe('failed');
    expect(pickStatus({ hasPassed: false, hasFinished: false, hasOpened: true })).toBe('in_progress');
    expect(pickStatus({ hasPassed: false, hasFinished: false, hasOpened: false })).toBe('not_started');
  });
});

// ─── computeStatus: one person ────────────────────────────────────────────────

describe('computeStatus', () => {
  it('nothing at all → not_started, zero attempts, no dates', () => {
    const s = computeStatus('u1', quiz, [], []);
    expect(s).toEqual({ quizVersion: '2026.1', status: 'not_started', bestScore: 0, attempts: 0 });
  });

  it('opened but not submitted → in_progress', () => {
    expect(computeStatus('u1', quiz, [], [opened()]).status).toBe('in_progress');
  });

  it('an unfinished attempt (no completedAt) → in_progress, and isn’t counted as an attempt', () => {
    const s = computeStatus('u1', quiz, [attempt({ completedAt: undefined })], []);
    expect(s).toMatchObject({ status: 'in_progress', attempts: 0 });
  });

  it('finished but never passed → failed, with best score', () => {
    const s = computeStatus('u1', quiz, [fail('2026-11-01T10:00:00Z', 0.4), fail('2026-11-02T10:00:00Z', 0.6)], []);
    expect(s).toMatchObject({ status: 'failed', attempts: 2, bestScore: 0.6 });
    expect(s.completedAt).toBeUndefined();
  });

  it('failed then passed → completed; completedAt is the pass date', () => {
    const s = computeStatus('u1', quiz, [fail('2026-11-01T10:00:00Z'), pass('2026-11-02T10:00:00Z')], []);
    expect(s).toMatchObject({ status: 'completed', attempts: 2, completedAt: '2026-11-02T10:00:00Z' });
  });

  it('passed twice → completedAt stays the FIRST pass, even if records arrive out of order', () => {
    const s = computeStatus('u1', quiz, [pass('2026-11-05T10:00:00Z'), pass('2026-11-03T10:00:00Z')], []);
    expect(s.completedAt).toBe('2026-11-03T10:00:00Z');
  });

  it('passed then failed a retry → still completed (done stays done)', () => {
    const s = computeStatus('u1', quiz, [pass('2026-11-01T10:00:00Z', 0.9), fail('2026-11-02T10:00:00Z', 0.2)], []);
    expect(s).toMatchObject({ status: 'completed', bestScore: 0.9, completedAt: '2026-11-01T10:00:00Z' });
  });

  it('lastAttempt is the most recent finished attempt, with explanations attached', () => {
    const latest = fail('2026-11-09T10:00:00Z');
    const s = computeStatus('u1', quiz, [latest, pass('2026-11-01T10:00:00Z')], []);
    expect(s.lastAttempt).toMatchObject({ attemptId: latest.id, passed: false, completedAt: '2026-11-09T10:00:00Z' });
    expect(s.lastAttempt?.feedback[0]).toMatchObject({ questionId: 'q1', explanation: 'q1-explanation' });
  });

  it('a new quiz version resets everyone: old-version attempts and opens are ignored', () => {
    const old = pass('2025-11-01T10:00:00Z', 1, { quizVersion: '2025.1' });
    expect(computeStatus('u1', quiz, [old], [opened('u1', '2025.1')]).status).toBe('not_started');
  });

  it('other users’ records are ignored', () => {
    expect(computeStatus('u1', quiz, [pass('2026-11-01T10:00:00Z', 1, { userId: 'u2' })], [opened('u2')]).status).toBe(
      'not_started',
    );
  });
});

// ─── buildReport: everyone ────────────────────────────────────────────────────

describe('buildReport', () => {
  const users: User[] = [
    { id: 'u1', name: 'Zoe Done', email: 'zoe@example.com', role: ['user'] },
    { id: 'u2', name: 'Alex Failed', email: 'alex@example.com', role: ['user'] },
    { id: 'u3', name: 'Bea Started', email: 'bea@example.com', role: ['user'] },
    { id: 'u4', name: 'Cal Nothing', email: 'cal@example.com', role: ['user'] },
    { id: 'u4', name: 'Cal Nothing', email: 'cal@example.com', role: ['user'] }, // duplicate on purpose
  ];
  const attempts = [
    pass('2026-11-02T10:00:00Z', 0.9, { userId: 'u1' }),
    fail('2026-11-03T10:00:00Z', 0.5, { userId: 'u2' }),
    pass('2026-11-04T10:00:00Z', 1, { userId: 'gone' }), // not in the roster (left the company)
  ];
  const opens = [opened('u3')];
  const now = new Date('2026-11-20T00:00:00.000Z');
  const report = buildReport(quiz, users, attempts, opens, now);

  it('summary counts every roster user exactly once, including people who never started', () => {
    expect(report.summary).toEqual({ total: 4, done: 1, failed: 1, inProgress: 1, notStarted: 1 });
  });

  it('ignores attempts from people not on the roster', () => {
    expect(report.rows.map((r) => r.userId)).not.toContain('gone');
  });

  it('sorts people who need chasing first: not started, failed, in progress, completed', () => {
    expect(report.rows.map((r) => r.status)).toEqual(['not_started', 'failed', 'in_progress', 'completed']);
  });

  it('fills each row with the status numbers and dates', () => {
    expect(report.rows.find((r) => r.userId === 'u1')).toMatchObject({
      name: 'Zoe Done',
      status: 'completed',
      bestScore: 0.9,
      attempts: 1,
      completedAt: '2026-11-02T10:00:00Z',
      lastAttemptAt: '2026-11-02T10:00:00Z',
    });
  });

  it('rows don’t carry full attempt details (no explanations in the report)', () => {
    const json = JSON.stringify(report);
    expect(json).not.toContain('lastAttempt"');
    expect(json).not.toContain('explanation');
  });

  it('uses the given time and the quiz’s version/title', () => {
    expect(report).toMatchObject({ quizVersion: '2026.1', quizTitle: 'Test quiz', generatedAt: '2026-11-20T00:00:00.000Z' });
  });

  it('sorts by name within the same status', () => {
    const r = buildReport(quiz, [
      { id: 'a', name: 'Mia', email: 'm@example.com', role: ['user'] },
      { id: 'b', name: 'Ann', email: 'a@example.com', role: ['user'] },
    ], [], []);
    expect(r.rows.map((x) => x.name)).toEqual(['Ann', 'Mia']);
  });
});

// ─── small helpers ────────────────────────────────────────────────────────────

describe('percentComplete', () => {
  it('is done / total, and 0 for an empty roster', () => {
    expect(percentComplete({ total: 4, done: 1, failed: 1, inProgress: 1, notStarted: 1 })).toBe(0.25);
    expect(percentComplete({ total: 0, done: 0, failed: 0, inProgress: 0, notStarted: 0 })).toBe(0);
  });
});

describe('canViewReport', () => {
  it('only admins', () => {
    expect(canViewReport({ role: ['admin'] })).toBe(true);
    expect(canViewReport({ role: ['user', 'admin'] })).toBe(true);
    expect(canViewReport({ role: ['user'] })).toBe(false);
    expect(canViewReport({ role: [] })).toBe(false);
  });
});
