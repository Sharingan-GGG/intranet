# `audit` schema

Backs the SEO/GEO Audit Hub at `/audit`, migrated from the standalone portal
and its own Supabase project (`wykyknbeaektpbuhlehk`, now retired).

Like `pre_departure`, this schema is **not** part of Payload's migrations —
Payload owns `public` only and runs with `push: false`. The files in this
directory are the checked-in record; they are applied by hand, per environment.
There is no ledger, so note what you have applied where in the PR.

## Layout

```
schema.sql                      CREATE SCHEMA + grants
types/                          yes_no, schedule_type, status_type
tables/                         7 tables
views/tracker_latest_run.sql    DISTINCT ON newest run per tracker
```

## Applying

`payload_app` has no `CREATE` privilege on the database, so this must be run on
a **postgres-role** connection — the Supabase SQL editor, or a `postgres.<ref>`
pooler string. Generate the ordered bundle:

```bash
node -r dotenv/config scripts/audit-apply-schema.mjs --print dotenv_config_path=.env.local
```

That emits every file in dependency order wrapped in `BEGIN`/`COMMIT`. Paste it
into the SQL editor for the target project.

| Environment | Project ref            | Env file          |
| ----------- | ---------------------- | ----------------- |
| Staging     | `mckqcwpnaouqrfnoxils` | `.env.local`, `.env.staging` |
| Production  | `qpnyysjakayualiqtvyf` | `.env.production` |

Then copy the data across for that environment (see `scripts/audit-copy.mjs`).

> **`audit` is deliberately not in `api.schemas`.** The app reaches this schema
> over a direct Postgres connection (`src/lib/audit-db.ts`), not PostgREST, so
> it needs no exposure and `anon` gets no grants. This also sidesteps the
> exposed-schema trap that bit `pre_departure`: on staging, `db_schema` was
> updated to include `audit` and PostgREST kept serving the old list through a
> config reload *and* a full project restart (PGRST106). If you ever do want
> PostgREST access here, set it in the dashboard — never via
> `supabase config push`, which has no scope flag and would rewrite the
> project's auth URLs to localhost.

Run the copy script on its own: staging's pooler is `pool_size 15` and stacked
scripts exhaust it, which shows up as misleading connection errors.

## Notes on the schema

- **Column names are byte-identical to the old project**, including
  `seo_agent_tracker."Full Scan"` (space, capitalised) and `"Domain"` (capital
  D, unlike `content_audits.domain`). The external `seo-page-agents` routine
  reads and writes these directly; renaming them here would turn a one-line
  repoint into a coordinated multi-repo change. The cleanup lives in the
  TypeScript data layer instead. A physical rename is a reasonable follow-up
  once the cutover is proven.
- **No `anon` grants.** The old portal drove PostgREST straight from the
  browser with the anon key, which is why its RLS was wide open. The intranet
  port reads and writes only from the server, so `anon` gets nothing.
- `seo_site_content_audit` had **no primary key** in the old project. `id` and
  `url` were both already unique across all 817 rows, so both constraints are
  added here.
- `audit_runs.tracker_id` is deliberately `NO ACTION`, not `CASCADE` —
  cancelling a scheduled scan deletes the tracker row, and cascading would
  silently destroy that page's audit history.
- `app_secrets` is **not** recreated. Its 7 webhook URLs and tokens are env
  vars now (`AUDIT_*_FIRE_URL` / `AUDIT_*_FIRE_TOKEN`).
