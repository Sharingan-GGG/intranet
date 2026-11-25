import { isAdmin } from '../../../../lib/quiz/auth';
import { json, withUser } from '../../../../lib/quiz/http';

// GET /api/quiz/me
//   → 200 { id, name, email, isAdmin }: who the quiz thinks you are.
//     The UI uses it for "Signed in as …" and to decide whether to SHOW the admin link.
//     (Showing the link is cosmetic: the report route checks permission again on its own.)
//   → 401 not signed in, or signed in to the Intranet but not in the staff directory.
//
// Also handy when wiring up the Intranet: if this returns your details, auth is working.

export function GET() {
  return withUser('quiz/me', async (user) =>
    json({ id: user.id, name: user.name, email: user.email, isAdmin: isAdmin(user) }),
  );
}
