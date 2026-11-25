// Runtime validation for everything the browser sends us. Tested in schema.test.ts.
//
// WHY THIS EXISTS
//   TypeScript types vanish when the app runs, and anyone can send any JSON to an API route.
//   These zod schemas check the REAL request data before it reaches our logic.
//
// TWO-STAGE CHECKING
//   1. Here (zod): STRUCTURE. Is it an object? Are these strings? Are they a sane length?
//   2. scoring.ts sanitizeAnswers(): MEANING. Does this question exist? Is this option/action/hotspot
//      real? Is the simulation path possible?
//   Stage 1 runs first so stage 2 never has to deal with garbage like numbers, nulls or 10 MB strings.
//
// HOW TO USE IN A ROUTE
//   const parsed = SubmitAttemptRequestSchema.safeParse(await req.json());
//   if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
//   // parsed.data is now typed as SubmitAttemptRequest
//   (safeParse never throws. It returns { success: true, data } or { success: false, error }.)

import { z } from 'zod';
import type { StartQuizRequest, SubmitAttemptRequest } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Limits: exported so tests (and questions.test.ts) can check the real quiz fits inside them
// ─────────────────────────────────────────────────────────────────────────────

/** Longest id we accept: question ids, option ids, action ids, hotspot ids. */
export const MAX_ID_LENGTH = 50;

/**
 * Most items (questions + simulations) one submission may answer.
 * The quiz has ~15–25 items, so 100 is generous but still stops someone sending thousands of keys.
 */
export const MAX_ANSWERED_ITEMS = 100;

/**
 * Most ids in ONE answer. A choice question needs at most a handful of options. A simulation needs
 * (actions on its longest route) + (all of its hotspots): currently 7 at most.
 * questions.test.ts fails if a simulation is ever written that could need more than this.
 */
export const MAX_PICKS_PER_ANSWER = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An id: starts with a letter, then letters, digits, '_', '-' or '.', up to 50 characters.
 * Matches every id we author ('phish-01', 'a', 'true', 'open-attachment', 'h-domain').
 * Rejects empty strings, spaces, HTML/script, paths like '../x', and odd keys like '__proto__'.
 * Exported so questions.test.ts can check every id we author passes it.
 */
export const IdSchema = z
  .string()
  .max(MAX_ID_LENGTH)
  .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, 'Invalid id');

/** A quiz version like '2026.1': digits, letters, '.' and '-' only. */
const QuizVersionSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .regex(/^[A-Za-z0-9.-]+$/, 'Invalid quiz version');

// ─────────────────────────────────────────────────────────────────────────────
// Request bodies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Body of POST /api/quiz/submit.
 * Structural check only: the answers are checked against the actual quiz by sanitizeAnswers().
 *
 * `satisfies z.ZodType<SubmitAttemptRequest>` ties this schema to the TypeScript type in types.ts.
 * If someone changes one and not the other, `npm run typecheck` fails, so they can't drift apart.
 */
export const SubmitAttemptRequestSchema = z.object({
  quizVersion: QuizVersionSchema,

  // Only a real ISO timestamp, e.g. '2026-11-17T00:00:00.000Z'. (zod 4 syntax: z.iso.datetime())
  // Whether the time is plausible (not in the future, etc.) is up to the route, not structure.
  startedAt: z.iso.datetime(),

  // questionId → list of ids. Each list is capped, and so is the number of keys
  // (z.record has no built-in key limit, hence the .refine).
  answers: z
    .record(IdSchema, z.array(IdSchema).max(MAX_PICKS_PER_ANSWER))
    .refine((a) => Object.keys(a).length <= MAX_ANSWERED_ITEMS, {
      message: `At most ${MAX_ANSWERED_ITEMS} answers`,
    }),
}) satisfies z.ZodType<SubmitAttemptRequest>;

/** Body of POST /api/quiz/start ("I've opened the quiz"). Just the version. */
export const StartRequestSchema = z.object({
  quizVersion: QuizVersionSchema,
}) satisfies z.ZodType<StartQuizRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// URL parameters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt ids from the URL (/security-quiz/result/[attemptId]): 8–64 letters, digits, '-' or '_'.
 * Anything else ('../../etc', scripts, huge strings) is rejected before we look anything up.
 */
export const AttemptIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid attempt id');
