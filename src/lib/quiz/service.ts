import 'server-only';
import { getBackend } from './backend';
import { CURRENT_QUIZ, getQuizByVersion } from './current';
import { drawItemIds, drawKey, toPublicDraw } from './draw';
import { isAdmin } from './roles';
import { AttemptIdSchema } from './schema';
import { sanitizeAnswers, scoreAttempt, toAttemptResult } from './scoring';
import { buildReport, canViewReport, computeStatus } from './status';
import type { AttemptResult, MyStatus, PublicQuiz, Quiz, Report, StoredAttempt, SubmitAttemptRequest, User } from './types';

// THE APP'S USE CASES: one function per thing a person can do.
// API routes and Server Component pages both call these, so the rules live in ONE place and
// pages never fetch their own API.
//
// Every function takes the `user` from getCurrentUser() (auth.ts) as its first argument.
// Identity is never read from the request, so nobody can act as someone else.
//
// Outcomes use "result objects" ({ ok: true, … } | { ok: false, status, errors }), so the
// route turns them into HTTP responses and TypeScript forces it to handle failures.

/** Allowed clock difference between the browser and the server when checking startedAt. */
const CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * The draw key for the attempt this person is on NOW: their number of finished attempts + 1.
 * It only changes when they submit, so the quiz page and the submit see the same selection
 * (see draw.ts for why nothing needs storing).
 */
async function currentDrawKey(user: User, quiz: Quiz): Promise<string> {
  const mine = await getBackend().listAttempts({ quizVersion: quiz.version, userId: user.id });
  const finished = mine.filter((a) => a.completedAt).length;
  return drawKey(user.id, quiz.version, finished + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// The quiz to show
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The PUBLIC quiz for this person's current attempt: their own selection of items, in their own
 * order, answer key stripped. Same result on every call until they submit.
 */
export async function getQuizForUser(user: User): Promise<PublicQuiz> {
  return toPublicDraw(CURRENT_QUIZ, await currentDrawKey(user, CURRENT_QUIZ));
}

// ─────────────────────────────────────────────────────────────────────────────
// My status (the Intranet card)
// ─────────────────────────────────────────────────────────────────────────────

/** The signed-in person's status for the live quiz. Loads attempts and starts in parallel. */
export async function getMyStatus(user: User): Promise<MyStatus> {
  const filter = { quizVersion: CURRENT_QUIZ.version, userId: user.id };
  const backend = getBackend();
  const [attempts, starts] = await Promise.all([backend.listAttempts(filter), backend.listStarts(filter)]);
  return computeStatus(user.id, CURRENT_QUIZ, attempts, starts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Opening the quiz
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "I've opened the quiz". Marks the person as in progress.
 * Refuses an outdated version (someone with an old tab open). Safe to call repeatedly.
 */
export async function recordStart(user: User, quizVersion: string): Promise<{ ok: boolean }> {
  if (quizVersion !== CURRENT_QUIZ.version) return { ok: false };
  await getBackend().recordStart({ userId: user.id, quizVersion, startedAt: new Date().toISOString() });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Submitting (the most important function)
// ─────────────────────────────────────────────────────────────────────────────

export type SubmitOutcome =
  | { ok: true; result: AttemptResult }
  | { ok: false; status: 400 | 409; errors: string[] };

/** 409 message when the answers are for a different selection than the server expects. */
export const SELECTION_CHANGED =
  'Your set of questions has changed (for example, you submitted this quiz in another tab). Please reload the page.';

/**
 * Checks, scores and saves an attempt. `body` must already have passed SubmitAttemptRequestSchema
 * (structure). The checks here are about MEANING, in this order:
 *   1. Version: the quiz hasn't changed since they opened it        → else 409 Conflict
 *   2. Clock: startedAt isn't in the future (5 min allowance)        → else 400
 *   3. sanitizeAnswers: every question/option/action/hotspot is real → else 400
 *   4. Selection: only items from THIS attempt's draw are answered   → else 409 (a stale tab)
 *   5. Everything in the draw answered                               → else 400
 *   6. Score ON THE SERVER, against the draw only. Any score the browser might claim is never used.
 *   7. Save, then return the result with explanations.
 */
export async function submitAttempt(user: User, body: SubmitAttemptRequest): Promise<SubmitOutcome> {
  const quiz = CURRENT_QUIZ;

  // 1. Version
  if (body.quizVersion !== quiz.version) {
    return { ok: false, status: 409, errors: ['This quiz has been replaced by a newer version. Please reload.'] };
  }

  // 2. Clock
  const now = new Date();
  if (Date.parse(body.startedAt) > now.getTime() + CLOCK_SKEW_MS) {
    return { ok: false, status: 400, errors: ['startedAt is in the future'] };
  }

  // 3. Meaning of each answer
  const clean = sanitizeAnswers(quiz, body.answers);
  if (!clean.ok) return { ok: false, status: 400, errors: clean.errors };

  // 4. Only this attempt's items. The draw is worked out again here from who they are and how many
  //    attempts they've finished, so the browser can't choose (or swap in) its own questions.
  //    A real item from outside the draw almost always means a stale tab whose selection was
  //    replaced by a submit elsewhere: 409, "reload".
  const itemIds = drawItemIds(quiz, await currentDrawKey(user, quiz));
  const drawn = new Set(itemIds);
  if (Object.keys(clean.answers).some((id) => !drawn.has(id))) {
    return { ok: false, status: 409, errors: [SELECTION_CHANGED] };
  }

  // 5. Nothing skipped. (An unfinished simulation still counts as "answered" here, and it scores
  //    as wrong, but a simulation with no actions at all is treated as skipped.)
  const unanswered = itemIds.filter((id) => !clean.answers[id]?.length);
  if (unanswered.length) {
    return { ok: false, status: 400, errors: [`${unanswered.length} question(s) are unanswered`] };
  }

  // 6 + 7. Score on the server (drawn items only, in the order shown), save, return
  const attempt = await getBackend().saveAttempt({
    quizVersion: quiz.version,
    userId: user.id, // from the verified session, never from the body
    startedAt: body.startedAt,
    completedAt: now.toISOString(),
    answers: clean.answers,
    ...scoreAttempt(quiz, clean.answers, itemIds),
  });
  return { ok: true, result: toAttemptResult(attempt, quiz) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewing a result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One attempt, ONLY if it's the user's own, or the user is an admin.
 * Someone else's attempt returns null, exactly like a missing one, so nobody can even tell
 * whether an id exists. Old versions still open (getQuizByVersion keeps past quizzes).
 */
export async function getAttemptForUser(
  user: User,
  id: string,
): Promise<{ attempt: StoredAttempt; result: AttemptResult; quiz: Quiz } | null> {
  if (!AttemptIdSchema.safeParse(id).success) return null; // garbage id: don't even query
  const attempt = await getBackend().getAttempt(id);
  if (!attempt) return null;
  if (attempt.userId !== user.id && !isAdmin(user)) return null;
  const quiz = getQuizByVersion(attempt.quizVersion);
  return quiz ? { attempt, result: toAttemptResult(attempt, quiz), quiz } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin report
// ─────────────────────────────────────────────────────────────────────────────

export type ReportOutcome = { ok: true; report: Report } | { ok: false; status: 403 };

/**
 * Everyone's status for the live quiz. Checks permission ITSELF (admins only), on top of the
 * check the page/route should also do: belt and braces, so a future caller can't forget it.
 */
export async function getReport(viewer: User): Promise<ReportOutcome> {
  if (!canViewReport(viewer)) return { ok: false, status: 403 };
  const filter = { quizVersion: CURRENT_QUIZ.version };
  const backend = getBackend();
  const [staff, attempts, starts] = await Promise.all([
    backend.listStaff(),
    backend.listAttempts(filter),
    backend.listStarts(filter),
  ]);
  return { ok: true, report: buildReport(CURRENT_QUIZ, staff, attempts, starts, new Date()) };
}
