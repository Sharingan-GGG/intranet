# Audit Hub (`/audit`)

SEO/GEO page audits for the group's three WordPress sites, migrated from the
standalone portal at `GEO - SEO Web Portal` and its own Supabase project
(`wykyknbeaektpbuhlehk`, now retired).

The tool only ever *queues* work. The audits themselves are produced by two
Claude Code routines that run out of band and write their results straight into
the `audit` schema:

| Worker | Reads | Writes |
| --- | --- | --- |
| `seo-page-agents` | `seo_agent_tracker` where `started_at is null` | `audit_runs`, `audit_issues`, and the tracker's status |
| Site content audit | `content_audits` where `status = 'queued'` | `content_audits.report` + `.summary_report` |

## Screens

| Path | What it is |
| --- | --- |
| `/audit` | Redirect into the Dashboard's default tab |
| `/audit/scheduler/content-pre-check` | Every page on the domain, against the content triage queue. The only tab that can queue a content audit. |
| `/audit/scheduler/full-seo-page-scan` | Pages promoted from Content. Run / Report / Done / Cancel, plus Scan Type and Assigned. |
| `/audit/scheduler/archived` | `content_audits` rows with `archived = true` |
| `/audit/scheduler/completed` | Full-scan rows whose tracker status is Done |
| `/audit/completed` | The standalone Completed table — adds keyphrase, keyword score and the stat cards |
| `/audit/domain-list` | One card per site with live published counts |
| `…/page-detail/{trackerId}` | One full-scan run: gauge, dimension bars, findings, history |
| `…/content-audit/{id}` | A content triage row, rendered through the same screen |

`scheduler` is the URL segment the portal shipped and is kept so existing links
resolve; the screen is the **Dashboard** everywhere in the UI.

## Two invariants that are easy to break

- **The summary boxes count visible rows**, so every active filter applies to
  them. A box that counted `rows` rather than `visible` would disagree with the
  table under it.
- **Bulk actions only touch rows that are both ticked and visible.** Narrowing
  the list must never queue something the user cannot see.

A third, in the finding counts: **only a page's newest run counts.** Page Detail
renders that run's findings and nothing else, so summing every run made the box
impossible to reconcile — a page scanned five times showed 151 open against 12
on screen.

## Shape

```
src/app/audit/**                     routes, layout, server actions
src/components/work/audit/**         client components
src/lib/audit-*.ts                   data layer, roster, route model, adapters
src/lib/audit-db.ts                  pg pool + auditQuery(), the direct connection
supabase/database/schemas/audit/**   the schema itself (see its own README)
scripts/audit-copy.mjs               one-time data copy from the old project
```

Data access is **plain SQL over a direct Postgres connection**, not supabase-js.
PostgREST will not serve a schema that is not in its exposed list, and on this
project the saved config and the running service disagree — `audit` is
configured but PGRST106 persisted through a reload and a full restart. A direct
connection sidesteps that, and costs nothing: every caller is server-side and
`payload_app` owns every table in the schema, so it bypasses RLS. One small
shared pool, because the session pooler is `pool_size 15` shared with Payload.

Reads happen in server components and throw on failure, so a broken query hits
an error boundary instead of rendering as an empty table. Writes are server
actions that return a result for the UI to toast, and each re-checks
`route:audit` — a server action is reachable by anyone who can guess its id, so
the check on the page only decides what renders.

## Access

Three layers, the same as Pre-Departure:

1. `AUDIT_ENABLED` in `src/middleware.ts` — inlined at build time; unset on a
   production build and `/audit` 404s rather than redirecting to login.
2. The global session gate.
3. `route:audit` via `hasPageAccess`, granted per department in the Payload
   admin. Default-deny.

The nav link is CMS-managed (a Quick Link or Header item pointing at `/audit`),
not in code.

## Roster

Assignment is stored on `seo_agent_tracker.assigned` as **emails**. The portal
stored bare first names against two hardcoded arrays; those nine names turned
out to be exactly the Marketing and IT departments, so the roster is a Payload
query now (`lib/audit-roster.ts`) and adding someone to the department is all
that is needed. Email is the join key used everywhere else between Supabase Auth
and Payload users, and unlike a display name it survives a rename.

Which team a page's assignees are on decides which findings count as theirs —
`MARKETING_DIMS` and its exact complement. Assigned across both teams, or
unassigned, counts everything.

## Things deliberately not carried over

- The hand-rolled `history.pushState` router — App Router expresses the same
  URLs natively.
- `src/schedule.ts`, a localStorage run schedule nothing ever polled.
- `src/dom.ts` (`el`, `escapeHtml`) — JSX replaces it.
- The anon Supabase key in the browser, and with it the wide-open RLS the portal
  needed. Nothing client-side touches the database now.
- `app_secrets` — its seven webhook URLs and tokens are env vars
  (`AUDIT_*_FIRE_URL` / `AUDIT_*_FIRE_TOKEN`).
- The `fire-site-content-audit` edge function, replaced by the outbound POST in
  `actions.ts`.
