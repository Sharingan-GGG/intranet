import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quiz, QuizOpenEvent, StoredAttempt, User } from '../../../lib/quiz/types';

/*
 * Tests every API route by calling its GET/POST function directly with a real Request object,
 * exactly as Next.js would. No server, no browser, no database.
 *
 * What's REAL here: the routes, http.ts (401/415/413/400/502 handling), schema.ts (zod),
 * service.ts (version/clock/answer checks + server-side scoring), status.ts (report + CSV).
 * What's FAKE:
 *   - 'server-only'        → empty module (it throws outside Next.js)
 *   - 'next/navigation'    → unstable_rethrow does nothing (there are no Next.js signals in tests)
 *   - auth.getCurrentUser  → returns whoever `session.user` is set to (null = signed out)
 *   - current.ts           → a tiny 2-question test quiz
 *   - backend.ts           → an in-memory store, reset before each test
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }));

const { testQuiz, store, session } = vi.hoisted(() => {
  const testQuiz: Quiz = {
    version: 'test.1',
    title: 'Test',
    passMark: 0.5,
    questions: [
      { id: 'q1', topic: 'phishing', type: 'single', prompt: 'Q1', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correct: ['a'], explanation: 'e1' },
      { id: 'q2', topic: 'devices', type: 'single', prompt: 'Q2', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correct: ['b'], explanation: 'e2' },
    ],
  };
  const store = { attempts: [] as StoredAttempt[], starts: [] as QuizOpenEvent[], staff: [] as User[], failSaves: false };
  const session = { user: null as User | null };
  return { testQuiz, store, session };
});

vi.mock('../../../lib/quiz/auth', () => ({
  getCurrentUser: async () => session.user,
  isAdmin: (u: User) => u.role.includes('admin'),
}));

vi.mock('../../../lib/quiz/current', async () => {
  const { toPublicQuiz } = await import('../../../lib/quiz/scoring');
  return {
    CURRENT_QUIZ: testQuiz,
    getQuizByVersion: (v: string) => (v === testQuiz.version ? testQuiz : undefined),
    getPublicQuiz: () => toPublicQuiz(testQuiz),
  };
});

vi.mock('../../../lib/quiz/backend', () => ({
  getBackend: () => ({
    saveAttempt: async (input: Omit<StoredAttempt, 'id'>) => {
      if (store.failSaves) throw new Error('connection refused (secret internal detail)');
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

import * as quizRoute from './route';
import * as statusRoute from './status/route';
import * as startRoute from './start/route';
import * as submitRoute from './submit/route';
import * as reportRoute from './report/route';
import * as meRoute from './me/route';
import * as attemptRoute from './attempts/[id]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const alex: User = { id: 'u-alex', name: 'Alex', email: 'alex@example.test', role: ['user'] };
const sam: User = { id: 'u-sam', name: 'Sam', email: 'sam@example.test', role: ['user'] };
const admin: User = { id: 'u-admin', name: 'Admin', email: 'admin@example.test', role: ['user', 'admin'] };

const BASE = 'http://localhost/api/quiz';

/** A JSON POST, like the browser's fetch(url, { method: 'POST', body: JSON.stringify(...) }). */
function post(path: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const goodSubmission = (answers: Record<string, string[]> = { q1: ['a'], q2: ['b'] }) => ({
  quizVersion: 'test.1',
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  answers,
});

const attemptCtx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  session.user = alex;
  store.attempts = [];
  store.starts = [];
  store.staff = [alex, sam, admin];
  store.failSaves = false;
});

// ─── Every route refuses anonymous requests ───────────────────────────────────

describe('signed out → 401 everywhere', () => {
  beforeEach(() => {
    session.user = null;
  });

  it.each([
    ['GET /api/quiz', () => quizRoute.GET()],
    ['GET /api/quiz/status', () => statusRoute.GET()],
    ['GET /api/quiz/me', () => meRoute.GET()],
    ['POST /api/quiz/start', () => startRoute.POST(post('/start', { quizVersion: 'test.1' }))],
    ['POST /api/quiz/submit', () => submitRoute.POST(post('/submit', goodSubmission()))],
    ['GET /api/quiz/report', () => reportRoute.GET(new Request(`${BASE}/report`))],
    ['GET /api/quiz/attempts/:id', () => attemptRoute.GET(new Request(`${BASE}/attempts/x`), attemptCtx('00000000-0000-4000-8000-000000000001'))],
  ])('%s', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not signed in' });
  });

  it('nothing is written when signed out', async () => {
    await submitRoute.POST(post('/submit', goodSubmission()));
    await startRoute.POST(post('/start', { quizVersion: 'test.1' }));
    expect(store.attempts).toHaveLength(0);
    expect(store.starts).toHaveLength(0);
  });
});

// ─── GET /api/quiz ────────────────────────────────────────────────────────────

describe('GET /api/quiz', () => {
  it('returns the quiz WITHOUT answers or explanations, never cached', async () => {
    const res = await quizRoute.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const text = await res.text();
    expect(text).not.toContain('"correct"');
    expect(text).not.toContain('"explanation"');
    expect(JSON.parse(text)).toMatchObject({ version: 'test.1', questions: [{ id: 'q1' }, { id: 'q2' }] });
  });
});

// ─── GET /api/quiz/me ─────────────────────────────────────────────────────────

describe('GET /api/quiz/me', () => {
  it('normal staff', async () => {
    expect(await (await meRoute.GET()).json()).toEqual({ id: 'u-alex', name: 'Alex', email: 'alex@example.test', isAdmin: false });
  });
  it('admin', async () => {
    session.user = admin;
    expect(await (await meRoute.GET()).json()).toMatchObject({ isAdmin: true });
  });
});

// ─── POST /api/quiz/start + GET /api/quiz/status ──────────────────────────────

describe('start → status', () => {
  it('not_started → 204 on start → in_progress', async () => {
    expect(await (await statusRoute.GET()).json()).toMatchObject({ status: 'not_started', attempts: 0 });

    const res = await startRoute.POST(post('/start', { quizVersion: 'test.1' }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    const status = await statusRoute.GET();
    expect(status.headers.get('cache-control')).toBe('private, no-store');
    expect(await status.json()).toMatchObject({ quizVersion: 'test.1', status: 'in_progress' });
  });

  it('starting twice keeps one start', async () => {
    await startRoute.POST(post('/start', { quizVersion: 'test.1' }));
    await startRoute.POST(post('/start', { quizVersion: 'test.1' }));
    expect(store.starts).toHaveLength(1);
  });

  it('old version → 409', async () => {
    expect((await startRoute.POST(post('/start', { quizVersion: 'old.1' }))).status).toBe(409);
  });

  it('bad bodies → 400 / 415', async () => {
    expect((await startRoute.POST(post('/start', '{not json'))).status).toBe(400);
    expect((await startRoute.POST(post('/start', {}))).status).toBe(400);
    expect((await startRoute.POST(post('/start', { quizVersion: 'test.1' }, { 'content-type': 'text/plain' }))).status).toBe(415);
  });

  it('a body cannot pick the user: the start is recorded for the SESSION user', async () => {
    await startRoute.POST(post('/start', { quizVersion: 'test.1', userId: 'u-sam' }));
    expect(store.starts.map((s) => s.userId)).toEqual(['u-alex']);
  });
});

// ─── POST /api/quiz/submit ────────────────────────────────────────────────────

describe('POST /api/quiz/submit', () => {
  it('201 with the result; saved under the session user; status becomes completed', async () => {
    const res = await submitRoute.POST(post('/submit', goodSubmission()));
    expect(res.status).toBe(201);
    const result = await res.json();
    expect(result).toMatchObject({ quizVersion: 'test.1', correctCount: 2, total: 2, passed: true });
    expect(result.feedback).toMatchObject([
      { questionId: 'q1', correct: true, explanation: 'e1' },
      { questionId: 'q2', correct: true, explanation: 'e2' },
    ]);
    expect(store.attempts[0].userId).toBe('u-alex');
    expect(await (await statusRoute.GET()).json()).toMatchObject({ status: 'completed', attempts: 1 });
  });

  it('the result never includes the answer key', async () => {
    const text = await (await submitRoute.POST(post('/submit', goodSubmission({ q1: ['b'], q2: ['a'] })))).text();
    expect(text).not.toContain('"correct":["');
    expect(JSON.parse(text)).toMatchObject({ passed: false, correctCount: 0 });
  });

  it('score claimed by the browser is ignored (extra fields are stripped by the schema)', async () => {
    const res = await submitRoute.POST(post('/submit', { ...goodSubmission({ q1: ['b'], q2: ['a'] }), score: 1, passed: true }));
    expect(await res.json()).toMatchObject({ score: 0, passed: false });
  });

  it('invalid JSON → 400', async () => {
    const res = await submitRoute.POST(post('/submit', '{"quizVersion":'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('wrong shape → 400 with zod issues', async () => {
    const res = await submitRoute.POST(post('/submit', { quizVersion: 'test.1', answers: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid submission');
    expect(body.issues.some((i: { path: string[] }) => i.path.includes('startedAt'))).toBe(true);
  });

  it('unknown option → 400; unanswered → 400; old version → 409', async () => {
    expect((await submitRoute.POST(post('/submit', goodSubmission({ q1: ['z'], q2: ['b'] })))).status).toBe(400);

    const unanswered = await submitRoute.POST(post('/submit', goodSubmission({ q1: ['a'] })));
    expect(unanswered.status).toBe(400);
    expect(await unanswered.json()).toMatchObject({ errors: ['1 question(s) are unanswered'] });

    expect((await submitRoute.POST(post('/submit', { ...goodSubmission(), quizVersion: 'old.1' }))).status).toBe(409);
    expect(store.attempts).toHaveLength(0);
  });

  it('not JSON content-type → 415', async () => {
    expect((await submitRoute.POST(post('/submit', goodSubmission(), { 'content-type': 'application/x-www-form-urlencoded' }))).status).toBe(415);
  });

  it('body larger than 256 KB → 413, before parsing', async () => {
    const huge = JSON.stringify({ ...goodSubmission(), padding: 'x'.repeat(300 * 1024) });
    expect((await submitRoute.POST(post('/submit', huge))).status).toBe(413);
  });

  it('storage failure → 502 with a friendly message; the real error is only logged on the server', async () => {
    store.failSaves = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await submitRoute.POST(post('/submit', goodSubmission()));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain('secret internal detail');
    expect(log).toHaveBeenCalledWith('[quiz/submit] failed', expect.any(Error));
    log.mockRestore();
  });
});

// ─── GET /api/quiz/attempts/[id] ──────────────────────────────────────────────

describe('GET /api/quiz/attempts/[id]', () => {
  async function submitAs(user: User) {
    session.user = user;
    const r = await (await submitRoute.POST(post('/submit', goodSubmission()))).json();
    return r.attemptId as string;
  }
  const get = (id: string) => attemptRoute.GET(new Request(`${BASE}/attempts/${id}`), attemptCtx(id));

  it('owner sees it', async () => {
    const id = await submitAs(alex);
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ attemptId: id, passed: true });
  });

  it("someone else's attempt → 404 (same as a missing one); an admin can see it", async () => {
    const id = await submitAs(alex);
    session.user = sam;
    expect((await get(id)).status).toBe(404);
    session.user = admin;
    expect((await get(id)).status).toBe(200);
  });

  it('garbage or unknown id → 404', async () => {
    expect((await get('../../etc/passwd')).status).toBe(404);
    expect((await get('00000000-0000-4000-8000-999999999999')).status).toBe(404);
  });
});

// ─── GET /api/quiz/report ─────────────────────────────────────────────────────

describe('GET /api/quiz/report', () => {
  it('normal staff → 403', async () => {
    expect((await reportRoute.GET(new Request(`${BASE}/report`))).status).toBe(403);
    expect((await reportRoute.GET(new Request(`${BASE}/report?format=csv`))).status).toBe(403);
  });

  it('admin → JSON report with everyone, never cached', async () => {
    await submitRoute.POST(post('/submit', goodSubmission())); // Alex completes
    session.user = admin;
    const res = await reportRoute.GET(new Request(`${BASE}/report`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const report = await res.json();
    expect(report.summary).toEqual({ total: 3, done: 1, failed: 0, inProgress: 0, notStarted: 2 });
  });

  it('admin + ?format=csv → CSV download', async () => {
    session.user = admin;
    const res = await reportRoute.GET(new Request(`${BASE}/report?format=csv`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="security-quiz-test.1-report.csv"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const bytes = new Uint8Array(await res.arrayBuffer());
    // The BOM is sent as the bytes EF BB BF. (res.text() would silently strip it, so check the raw bytes.)
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder().decode(bytes);
    expect(csv.split('\r\n')[0]).toBe('Name,Email,Status,Best score (%),Attempts,Completed at,Last attempt at');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(4); // header + 3 staff
  });
});


