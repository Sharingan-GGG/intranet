import { errorJson, readJsonBody, withUser } from '../../../../lib/quiz/http';
import { StartRequestSchema } from '../../../../lib/quiz/schema';
import { recordStart } from '../../../../lib/quiz/service';

// POST /api/quiz/start   body: { "quizVersion": "2026.1" }
//   "I've opened the quiz." Moves the person from Not started → In progress on the report.
//   The quiz page calls it once when it loads. Calling it again is safe: the FIRST start time is kept.
//
//   → 204 recorded (nothing to send back)
//   → 400 body isn't valid JSON, or doesn't match StartRequestSchema
//   → 401 not signed in
//   → 409 the version they opened is no longer the live quiz (an old tab): reload the page
//   → 413 / 415 see readJsonBody in http.ts

export function POST(request: Request) {
  return withUser('quiz/start', async (user) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const parsed = StartRequestSchema.safeParse(body.value);
    if (!parsed.success) return errorJson(400, 'Invalid request');

    const { ok } = await recordStart(user, parsed.data.quizVersion); // user comes from the session
    if (!ok) return errorJson(409, 'This quiz has been replaced by a newer version. Please reload.');

    return new Response(null, { status: 204 });
  });
}
