import { json, withUser } from '../../../../lib/quiz/http';
import { getMyStatus } from '../../../../lib/quiz/service';
import type { MyStatus } from '../../../../lib/quiz/types';

// GET /api/quiz/status
//   → 200 MyStatus for the SIGNED-IN person and the CURRENT quiz version:
//     { quizVersion, status, bestScore, attempts, completedAt?, lastAttempt? }
//     This is what the Intranet's "Security quiz" card shows.
//   → 401 if nobody is signed in.
//
// There is no ?userId= parameter, on purpose: you can only ever ask about yourself.
// (Admins see everyone through /api/quiz/report.)

export function GET() {
  return withUser('quiz/status', async (user) => {
    const status = await getMyStatus(user);
    return json(status satisfies MyStatus); // `satisfies`: TypeScript confirms the agreed shape
  });
}
