import { errorJson, json, readJsonBody, withUser } from '../../../../lib/quiz/http';
import { SubmitAttemptRequestSchema } from '../../../../lib/quiz/schema';
import { submitAttempt } from '../../../../lib/quiz/service';
import type { AttemptResult } from '../../../../lib/quiz/types';

// POST /api/quiz/submit   body: SubmitAttemptRequest
//   { "quizVersion": "2026.1", "startedAt": "2026-11-19T01:00:00.000Z",
//     "answers": { "q1": ["b"], "sim-phish-01": ["report", "flag-sender"] } }
//
// THE JOURNEY OF A SUBMISSION (each step can stop it):
//   1. Who are you?                      withUser → 401 if nobody
//   2. Is the body JSON, and not huge?   readJsonBody → 415 / 413 / 400
//   3. Right STRUCTURE?                  zod schema → 400, with `issues` saying exactly what's wrong
//   4. Right MEANING?                    submitAttempt (service.ts): version → 409; clock, unknown
//                                        ids, impossible simulation paths, unanswered items → 400
//   5. Scored ON THE SERVER and saved    → 201 AttemptResult
//   6. Storage failed?                   withUser catches it and logs it on the server → 502
//
// The response has, per question: correct yes/no + explanation + policy reference.
// It never contains the answer key itself (which options were right).

export function POST(request: Request) {
  return withUser('quiz/submit', async (user) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const parsed = SubmitAttemptRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      // zod issues only describe the shape of what THEY sent (paths + messages), so they're safe
      // to return, and they make the problem obvious to whoever builds the front end.
      return errorJson(400, 'Invalid submission', { issues: parsed.error.issues });
    }

    const outcome = await submitAttempt(user, parsed.data);
    if (!outcome.ok) return errorJson(outcome.status, outcome.errors.join('; '), { errors: outcome.errors });

    return json(outcome.result satisfies AttemptResult, 201);
  });
}
