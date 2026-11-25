import { json, withUser } from '../../../lib/quiz/http';
import { getQuizForUser } from '../../../lib/quiz/service';

// GET /api/quiz
//   → 200 PublicQuiz: the signed-in person's selection for their current attempt (`order` = the
//     order to show it), WITHOUT answers, verdicts or explanations (stripped by the
//     toPublicQuiz / toPublicSimulation allow-lists). Same selection on every call until they submit.
//   → 401 if nobody is signed in. The quiz is internal training material, so it's staff-only
//     even though it contains no answers.
//
// Imports are relative (../../../lib/quiz/…) on purpose: in this project "@/" points at the
// root lib/ folder (shadcn's), and the Intranet may set "@/" up differently. Relative paths work in both.

export function GET() {
  // Each person gets THEIR selection for their current attempt (see draw.ts / getQuizForUser).
  return withUser('quiz', async (user) => json(await getQuizForUser(user)));
}
