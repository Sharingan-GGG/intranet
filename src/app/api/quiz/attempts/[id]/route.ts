import { errorJson, json, withUser } from '../../../../../lib/quiz/http';
import { getAttemptForUser } from '../../../../../lib/quiz/service';
import type { AttemptResult } from '../../../../../lib/quiz/types';

// GET /api/quiz/attempts/<attemptId>
//   → 200 AttemptResult: score, pass/fail and per-question feedback for ONE attempt,
//     e.g. for a "view your result" page or a link in a reminder email.
//   → 404 no such attempt, OR it belongs to someone else (and you're not an admin).
//     Both get the SAME answer on purpose, so nobody can probe which ids exist.
//   → 401 not signed in.
//
// `params` is a Promise in this version of Next.js, so it has to be awaited.

export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser('quiz/attempts', async (user) => {
    const { id } = await params;
    const found = await getAttemptForUser(user, id); // checks the id format and who owns it
    if (!found) return errorJson(404, 'Attempt not found');
    return json(found.result satisfies AttemptResult);
  });
}
