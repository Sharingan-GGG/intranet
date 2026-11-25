import { Download } from 'lucide-react';
import { Suspense } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { LocalTime } from '@/components/quiz/LocalTime';
import { API } from '@/components/quiz/paths';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { card } from '@/components/quiz/ui';
import { getCurrentUser } from '@/lib/quiz/auth';
import { formatScore } from '@/lib/quiz/scoring';
import { getReport } from '@/lib/quiz/service';
import { percentComplete } from '@/lib/quiz/status';

// /security-quiz/admin: completion report (admins only).
//
// Permission is checked HERE on the server (getReport refuses non-admins). Hiding the menu link
// is only a convenience; this check is the real protection.

export default function AdminReportPage() {
  return (
    <Suspense fallback={<div className={`${card} h-64 animate-pulse`} />}>
      <ReportView />
    </Suspense>
  );
}

async function ReportView() {
  const user = await getCurrentUser();
  const outcome = user ? await getReport(user) : null;
  if (!outcome?.ok) {
    return (
      <div className={`${card} mx-auto max-w-2xl p-6`}>
        <h1 className="text-xl font-semibold">Not available</h1>
        <p className="mt-2 text-muted-foreground">The completion report is only available to admins.</p>
      </div>
    );
  }

  const { report } = outcome;
  const { summary } = report;
  const pct = Math.round(percentComplete(summary) * 100);
  const stats = [
    { label: 'Completed', value: summary.done },
    { label: 'Not passed', value: summary.failed },
    { label: 'In progress', value: summary.inProgress },
    { label: 'Not started', value: summary.notStarted },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Completion report</h1>
          <p className="mt-1 text-muted-foreground">
            {report.quizTitle} · v{report.quizVersion} · all staff
          </p>
        </div>
        {/* A plain link: the browser downloads the CSV (content-disposition: attachment). */}
        <a href={API.reportCsv} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <Download aria-hidden="true" />
          Download CSV
        </a>
      </div>

      <section aria-label="Summary" className={`${card} p-6`}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-sm text-muted-foreground">
            <span className="text-3xl font-semibold text-foreground tabular-nums">{pct}%</span> · {summary.done} of {summary.total} staff
          </p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Staff completed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* overflow-x-auto: on a phone the table scrolls inside its card, not the whole page. */}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Quiz status for each staff member, people to follow up first</caption>
          <thead className="border-b text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Attempts</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Best</th>
              <th scope="col" className="px-4 py-3 font-medium">Completed</th>
              <th scope="col" className="px-4 py-3 font-medium">Last attempt</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {report.rows.map((r) => (
              <tr key={r.userId} className="hover:bg-muted/50">
                {/* Row header: screen readers say "Taylor Nguyen, Status, Not passed". */}
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-muted-foreground">{r.email}</div>
                </th>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.attempts}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.attempts ? formatScore(r.bestScore) : '–'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.completedAt ? <LocalTime iso={r.completedAt} dateOnly /> : '–'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.lastAttemptAt ? <LocalTime iso={r.lastAttemptAt} /> : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Generated <LocalTime iso={report.generatedAt} />
      </p>
    </div>
  );
}
