// Status + report logic: pure functions, no I/O, no framework imports. Unit-tested in status.test.ts.
//
// The caller (an API route) loads the raw records from the database/backend and passes them in.
// These functions only turn records into answers to two questions:
//   1. "Where am I up to?"            → computeStatus()  → MyStatus   (the Intranet card)
//   2. "Where is everyone up to?"     → buildReport()    → Report     (the admin page)
//
// ─── THE RULES (from the UI Build Guide, s.2) ────────────────────────────────
//   - Only attempts for the CURRENT quiz version count. Publishing a new version (e.g. 2027.1)
//     resets everyone to "not started", because their old attempts have the old version.
//   - Only FINISHED attempts (with a completedAt) count as attempts.
//   - A person is "completed" (done) once they have at least ONE passed attempt for this version.
//     Once completed, they stay completed, even if they retry later and fail.
//
// ─── STATUS DECISION, checked top to bottom, first match wins ────────────────
//   completed    at least one finished attempt passed
//   failed       has finished attempts, but none passed yet (they still need to retry)
//   in_progress  opened the quiz (open event, or an unfinished attempt), but hasn't submitted
//   not_started  nothing at all for this version

import { toAttemptResult } from './scoring';
import type {
  CompletionStatus,
  MyStatus,
  Quiz,
  QuizOpenEvent,
  Report,
  ReportRow,
  StoredAttempt,
  User,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

/** ISO timestamp → milliseconds, so dates are compared as numbers, not strings. */
const toMs = (iso: string) => Date.parse(iso);

/** A finished attempt is one with a valid completedAt. The type guard tells TypeScript it's set. */
type FinishedAttempt = StoredAttempt & { completedAt: string };
function isFinished(a: StoredAttempt): a is FinishedAttempt {
  return typeof a.completedAt === 'string' && !Number.isNaN(toMs(a.completedAt));
}

/** Group a list into a Map by key, e.g. attempts by userId. One pass, so the report stays fast. */
function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// The status decision (kept separate so the rule order is easy to read and test)
// ─────────────────────────────────────────────────────────────────────────────

/** Implements the decision table at the top of this file. Order matters: first match wins. */
export function pickStatus(facts: { hasPassed: boolean; hasFinished: boolean; hasOpened: boolean }): CompletionStatus {
  if (facts.hasPassed) return 'completed';
  if (facts.hasFinished) return 'failed';
  if (facts.hasOpened) return 'in_progress';
  return 'not_started';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. One person's status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Works out one user's status for `quiz` (normally CURRENT_QUIZ).
 *
 * `attempts` and `opens` can be ALL records, or just this user's: they're filtered here by
 * userId and version anyway, so passing extra records is harmless.
 */
export function computeStatus(
  userId: string,
  quiz: Quiz,
  attempts: readonly StoredAttempt[],
  opens: readonly QuizOpenEvent[],
): MyStatus {
  // Step 1: keep only THIS user's records for THIS quiz version.
  const mine = attempts.filter((a) => a.userId === userId && a.quizVersion === quiz.version);
  const openedQuiz = opens.some((o) => o.userId === userId && o.quizVersion === quiz.version);

  // Step 2: finished attempts, oldest first. We sort a copy because records may arrive in any order.
  const finished = mine.filter(isFinished).sort((a, b) => toMs(a.completedAt) - toMs(b.completedAt));
  const passed = finished.filter((a) => a.passed);

  // Step 3: decide the status.
  // An unfinished attempt record also counts as "opened", in case the open event was never saved.
  const status = pickStatus({
    hasPassed: passed.length > 0,
    hasFinished: finished.length > 0,
    hasOpened: openedQuiz || mine.some((a) => !isFinished(a)),
  });

  // Step 4: the numbers for the card.
  const firstPass = passed[0];                         // earliest pass = the date they became "done"
  const latest = finished[finished.length - 1];        // most recent finished attempt, pass or fail
  const bestScore = finished.reduce((best, a) => Math.max(best, a.score), 0); // 0 if no attempts

  return {
    quizVersion: quiz.version,
    status,
    bestScore,
    attempts: finished.length,                         // unfinished attempts aren't counted
    // completedAt = FIRST passed attempt, not the latest. That's the date they met the requirement,
    // which is what audit evidence needs, and later retries don't move it.
    ...(firstPass ? { completedAt: firstPass.completedAt } : {}),
    // Full result (score + explanations) of their latest attempt, for "see your last result".
    ...(latest ? { lastAttempt: toAttemptResult(latest, quiz) } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. The admin report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Row sort order: people who need chasing first, finished people last.
 * Within the same status, rows are sorted by name.
 */
const STATUS_ORDER: Record<CompletionStatus, number> = {
  not_started: 0,
  failed: 1,
  in_progress: 2,
  completed: 3,
};

/**
 * Builds the completion report for `quiz` over a ROSTER of users.
 *
 * - `users` is everyone who SHOULD complete the quiz (from Google Workspace / HR), not just people
 *   who submitted. That's how "not started" people show up at all.
 * - Attempts from people not in the roster (e.g. someone who has left) are ignored.
 * - A user listed twice in the roster appears once.
 * - `now` is a parameter (not `new Date()` inside) so the function stays pure and testable.
 */
export function buildReport(
  quiz: Quiz,
  users: readonly User[],
  attempts: readonly StoredAttempt[],
  opens: readonly QuizOpenEvent[],
  now: Date = new Date(),
): Report {
  // Group once up front, so each user is a quick Map lookup instead of re-scanning every record.
  const attemptsByUser = groupBy(attempts, (a) => a.userId);
  const opensByUser = groupBy(opens, (o) => o.userId);

  // Remove duplicate roster entries (same id), keeping the first.
  const roster = [...new Map(users.map((u) => [u.id, u] as const)).values()];

  const rows: ReportRow[] = roster.map((user) => {
    const s = computeStatus(user.id, quiz, attemptsByUser.get(user.id) ?? [], opensByUser.get(user.id) ?? []);
    // Fields are copied one by one ON PURPOSE: `lastAttempt` (with every explanation) is left out,
    // so the report stays small. Admins need the date of the last attempt, not its contents.
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      quizVersion: s.quizVersion,
      status: s.status,
      bestScore: s.bestScore,
      attempts: s.attempts,
      completedAt: s.completedAt,
      lastAttemptAt: s.lastAttempt?.completedAt,
    };
  });

  rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));

  // Summary tiles: count each status. Every row has exactly one status, so the four counts add up to total.
  const count = (status: CompletionStatus) => rows.filter((r) => r.status === status).length;

  return {
    quizVersion: quiz.version,
    quizTitle: quiz.title,
    generatedAt: now.toISOString(),
    summary: {
      total: rows.length,
      done: count('completed'),
      failed: count('failed'),
      inProgress: count('in_progress'),
      notStarted: count('not_started'),
    },
    rows,
  };
}

/** Fraction of the roster that is done, for the "% complete" tile. 0 when the roster is empty. */
export function percentComplete(summary: Report['summary']): number {
  return summary.total ? summary.done / summary.total : 0;
}

/**
 * Who may see the report. Check this in BOTH the admin page and the report API route.
 * Hiding the link isn't enough, because anyone can type the URL.
 */
export function canViewReport(user: Pick<User, 'role'>): boolean {
  return user.role.includes('admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CSV export of the report (GET /api/quiz/report?format=csv)
// ─────────────────────────────────────────────────────────────────────────────

/** Words a person reads in the spreadsheet, instead of the internal status codes. */
export const STATUS_LABELS: Record<CompletionStatus, string> = {
  completed: 'Completed',
  failed: 'Failed (needs retry)',
  in_progress: 'In progress',
  not_started: 'Not started',
};

/**
 * Makes one value safe to put in a CSV cell.
 *
 *  1. FORMULA INJECTION (a real attack, fittingly for a security quiz): Excel and Google Sheets run
 *     any cell starting with = + - @ (or tab / carriage return) as a formula. A staff name
 *     like  =HYPERLINK("http://evil…")  would run when an admin opens the file. Putting an
 *     apostrophe in front makes the spreadsheet show it as plain text.
 *  2. QUOTING (the CSV rules, RFC 4180): a value containing a comma, a double quote or a line break
 *     is wrapped in double quotes, and any double quote inside is doubled ("").
 */
export function csvCell(value: string | number | undefined | null): string {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The report as a CSV file, one row per staff member, in the same order as the report
 * (people to chase first). Dates stay in ISO format (e.g. 2026-11-19T03:15:00.000Z) so they sort
 * correctly and nothing depends on the server's time zone.
 *
 * Starts with a BOM (an invisible marker, \uFEFF) so Excel opens it as UTF-8 and names with accents
 * (e.g. "Nguyễn") display correctly. Lines end with \r\n, the CSV standard.
 */
export function reportToCsv(report: Report): string {
  const header = ['Name', 'Email', 'Status', 'Best score (%)', 'Attempts', 'Completed at', 'Last attempt at'];
  const lines = report.rows.map((r) =>
    [
      r.name,
      r.email,
      STATUS_LABELS[r.status],
      Math.round(r.bestScore * 100), // 0.85 → 85
      r.attempts,
      r.completedAt,
      r.lastAttemptAt,
    ]
      .map(csvCell)
      .join(','),
  );
  return '\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}
