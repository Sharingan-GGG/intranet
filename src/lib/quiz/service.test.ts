import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizOpenEvent, Quiz, StoredAttempt, User } from './types';

/*
 * Tests the use cases in service.ts WITHOUT a database or login:
 *  - 'server-only' is replaced with an empty module (it throws outside Next.js)
 *  - './current' is replaced with a tiny test quiz (2 choice questions, pass mark 50%)
 *  - './backend' is replaced with an in-memory store, reset before each test
 * vi.mock calls are hoisted above the imports, so service.ts sees the fakes.
 */

vi.mock('server-only', () => ({}));

// vi.hoisted: these values are created BEFORE the mocks run (plain top-level consts would not exist yet).
const { testQuiz, store } = vi.hoisted(() => {
  const testQuiz: Quiz = {
    version: 'test.1',
    title: 'Test',
    passMark: 0.5,
    questions: [
      { id: 'q1', topic: 'phishing', type: 'single', prompt: 'Q1', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correct: ['a'], explanation: 'e1' },
      { id: 'q2', topic: 'devices', type: 'single', prompt: 'Q2', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correct: ['b'], explanation: 'e2' },
    ],
  };
  // In-memory storage, same contract as QuizBackend
  const store = { attempts: [] as StoredAttempt[], starts: [] as QuizOpenEvent[], staff: [] as User[] };
  return { testQuiz, store };
});

vi.mock('./current', () => ({
  CURRENT_QUIZ: testQuiz,
  getQuizByVersion: (v: string) => (v === testQuiz.version ? testQuiz : undefined),
}));

vi.mock('./backend', () => ({
  getBackend: () => ({
    saveAttempt: async (input: Omit<StoredAttempt, 'id'>) => {
      const a = { id: `00000000-0000-4000-8000-${String(store.attempts.length + 1).padStart(12, '0')}`, ...input };
      store.attempts.push(a);
      return a;
    },
    getAttempt: async (id: string) => store.attempts.find((a) => a.id === id) ?? null,
    listAttempts: async (f: { quizVersion: string; userId?: string }) =>
      store.attempts.filter((a) => a.quizVersion === f.quizVersion && (!f.userId || a.userId === f.userId)),
    recordStart: async (s: QuizOpenEvent) => {
      if (!store.starts.some((x) => x.userId === s.userId && x.quizVersion === s.quizVersion)) store.starts.push(s);
    },
    listStarts: async (f: { quizVersion: string; userId?: string }) =>
      store.starts.filter((s) => s.quizVersion === f.quizVersion && (!f.userId || s.userId === f.userId)),
    listStaff: async () => store.staff,
  }),
}));

import { getAttemptForUser, getMyStatus, getQuizForUser, getReport, recordStart, SELECTION_CHANGED, submitAttempt } from './service';

const alex: User = { id: 'u-alex', name: 'Alex', email: 'alex@example.test', role: ['user'] };
const sam: User = { id: 'u-sam', name: 'Sam', email: 'sam@example.test', role: ['user'] };
const admin: User = { id: 'u-admin', name: 'Admin', email: 'admin@example.test', role: ['user', 'admin'] };

const body = (answers: Record<string, string[]>, over: Partial<{ quizVersion: string; startedAt: string }> = {}) => ({
  quizVersion: 'test.1',
  startedAt: new Date(Date.now() - 60_000).toISOString(), // a minute ago
  answers,
  ...over,
});

beforeEach(() => {
  store.attempts = [];
  store.starts = [];
  store.staff = [alex, sam, admin];
});

describe('submitAttempt: the checks, in order', () => {
  it('1. rejects an old quiz version with 409', async () => {
    const r = await submitAttempt(alex, body({ q1: ['a'], q2: ['b'] }, { quizVersion: 'old.1' }));
    expect(r).toMatchObject({ ok: false, status: 409 });
  });

  it('2. rejects a startedAt in the future (beyond 5 minutes)', async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(await submitAttempt(alex, body({ q1: ['a'], q2: ['b'] }, { startedAt: future }))).toMatchObject({ ok: false, status: 400 });
  });

  it('2. allows small clock differences (under 5 minutes ahead)', async () => {
    const slightlyAhead = new Date(Date.now() + 60_000).toISOString();
    expect((await submitAttempt(alex, body({ q1: ['a'], q2: ['b'] }, { startedAt: slightlyAhead }))).ok).toBe(true);
  });

  it('3. rejects unknown questions/options', async () => {
    expect(await submitAttempt(alex, body({ q1: ['z'], q2: ['b'] }))).toMatchObject({ ok: false, status: 400 });
  });

  it('4. rejects unanswered questions', async () => {
    const r = await submitAttempt(alex, body({ q1: ['a'] }));
    expect(r).toMatchObject({ ok: false, status: 400, errors: ['1 question(s) are unanswered'] });
  });

  it('nothing is saved when a check fails', async () => {
    await submitAttempt(alex, body({ q1: ['a'] }));
    expect(store.attempts).toHaveLength(0);
  });

  it('5–6. scores on the server, saves under the SESSION user, returns explanations', async () => {
    const r = await submitAttempt(alex, body({ q1: ['a'], q2: ['a'] })); // 1 of 2 right = 50% = pass
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toMatchObject({ correctCount: 1, total: 2, passed: true, feedback: [{ questionId: 'q1', correct: true, explanation: 'e1' }, { questionId: 'q2', correct: false, explanation: 'e2' }] });
    expect(store.attempts[0]).toMatchObject({ userId: 'u-alex', quizVersion: 'test.1' });
    expect(store.attempts[0].completedAt).toBeTruthy();
  });
});

describe('getMyStatus', () => {
  it('not started → in progress after recordStart → completed after a pass', async () => {
    expect((await getMyStatus(alex)).status).toBe('not_started');
    await recordStart(alex, 'test.1');
    expect((await getMyStatus(alex)).status).toBe('in_progress');
    await submitAttempt(alex, body({ q1: ['a'], q2: ['b'] }));
    expect(await getMyStatus(alex)).toMatchObject({ status: 'completed', attempts: 1, bestScore: 1 });
  });

  it('only counts the user’s own attempts', async () => {
    await submitAttempt(sam, body({ q1: ['a'], q2: ['b'] }));
    expect((await getMyStatus(alex)).status).toBe('not_started');
  });
});

describe('recordStart', () => {
  it('refuses an old version, and recording twice keeps one start', async () => {
    expect(await recordStart(alex, 'old.1')).toEqual({ ok: false });
    await recordStart(alex, 'test.1');
    await recordStart(alex, 'test.1');
    expect(store.starts).toHaveLength(1);
  });
});

describe('getAttemptForUser', () => {
  it('owner can see it, another staff member gets null, an admin can see it', async () => {
    const r = await submitAttempt(alex, body({ q1: ['a'], q2: ['b'] }));
    if (!r.ok) throw new Error('setup failed');
    const id = r.result.attemptId;
    expect(await getAttemptForUser(alex, id)).not.toBeNull();
    expect(await getAttemptForUser(sam, id)).toBeNull();
    expect(await getAttemptForUser(admin, id)).not.toBeNull();
  });

  it('garbage or unknown ids → null', async () => {
    expect(await getAttemptForUser(alex, '../../etc/passwd')).toBeNull();
    expect(await getAttemptForUser(alex, '00000000-0000-4000-8000-999999999999')).toBeNull();
  });
});

describe('getReport', () => {
  it('normal staff get 403', async () => {
    expect(await getReport(alex)).toEqual({ ok: false, status: 403 });
  });

  it('admins get everyone, including people who never started', async () => {
    await submitAttempt(alex, body({ q1: ['a'], q2: ['b'] }));
    const r = await getReport(admin);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.report.summary).toEqual({ total: 3, done: 1, failed: 0, inProgress: 0, notStarted: 2 });
  });
});

describe('random selection per attempt (quiz.draw)', () => {
  // Turn on a draw for these tests only: 1 of the 2 questions per attempt.
  beforeEach(() => {
    testQuiz.draw = { questions: 1, simulations: 0 };
    return () => {
      delete testQuiz.draw;
    };
  });

  const answerFor = (id: string) => ({ [id]: [id === 'q1' ? 'a' : 'b'] }); // the right answer for q1 / q2

  it('getQuizForUser: one item, `order` set, the same on every call (refresh can’t re-roll)', async () => {
    const first = await getQuizForUser(alex);
    expect(first.order).toHaveLength(1);
    expect(first.questions.map((q) => q.id)).toEqual(first.order);
    expect(await getQuizForUser(alex)).toEqual(first);
  });

  it('scores ONLY the drawn item: total 1, and the answer key is the same one the person was shown', async () => {
    const [drawn] = (await getQuizForUser(alex)).order!;
    const r = await submitAttempt(alex, body(answerFor(drawn)));
    expect(r).toMatchObject({ ok: true, result: { total: 1, correctCount: 1, passed: true } });
  });

  it('refuses an answer to a bank item that wasn’t drawn (stale tab / tampering) with 409', async () => {
    const [drawn] = (await getQuizForUser(alex)).order!;
    const other = drawn === 'q1' ? 'q2' : 'q1';
    const r = await submitAttempt(alex, body({ ...answerFor(drawn), ...answerFor(other) }));
    expect(r).toMatchObject({ ok: false, status: 409, errors: [SELECTION_CHANGED] });
  });

  it('after a submit, the next attempt is drawn with a new key (attempt 2)', async () => {
    const [drawn] = (await getQuizForUser(alex)).order!;
    await submitAttempt(alex, body(answerFor(drawn)));
    // Whatever attempt 2 draws, it's what the server will score: submitting it is accepted.
    const [next] = (await getQuizForUser(alex)).order!;
    expect(await submitAttempt(alex, body(answerFor(next)))).toMatchObject({ ok: true, result: { total: 1 } });
  });
});
