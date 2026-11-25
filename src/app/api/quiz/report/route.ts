import { errorJson, json, NO_STORE, withUser } from '../../../../lib/quiz/http';
import { getReport } from '../../../../lib/quiz/service';
import { reportToCsv } from '../../../../lib/quiz/status';

// GET /api/quiz/report             → 200 Report (JSON): summary tiles + one row per staff member
// GET /api/quiz/report?format=csv  → 200 CSV file download (the same rows)
//   → 401 not signed in
//   → 403 signed in but not an admin (Google super admin, see roles.ts)
//
// The admin check happens INSIDE getReport (service.ts), so no caller can skip it.
// The admin page must check too (canViewReport): hiding a link is never enough on its own.

export function GET(request: Request) {
  return withUser('quiz/report', async (user) => {
    const outcome = await getReport(user);
    if (!outcome.ok) return errorJson(403, 'Only admins can see the report');
    const { report } = outcome;

    if (new URL(request.url).searchParams.get('format') === 'csv') {
      return new Response(reportToCsv(report), {
        headers: {
          ...NO_STORE,
          'content-type': 'text/csv; charset=utf-8',
          // attachment = the browser downloads it as a file instead of showing it
          'content-disposition': `attachment; filename="security-quiz-${report.quizVersion}-report.csv"`,
        },
      });
    }
    return json(report);
  });
}
