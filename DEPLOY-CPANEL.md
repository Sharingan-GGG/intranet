# Deploying the Intranet — cPanel / LiteSpeed / Passenger

Live at **https://intranet.complextravel.net** (behind Cloudflare).
Server: `complextravel@13.236.149.83` (`server.complextravel.com.au`), SSH key `~/.ssh/intranet_ssh`.
App root on server: `/home/complextravel/public_html/intranet` (also the subdomain's docroot).

## How it runs
- Registered as a cPanel Passenger app named **Intranet** (`uapi PassengerApps list_applications`).
- LiteSpeed (Apache-compatible) spawns `app.js` (ESM) → imports `server.cjs` → boots Next.js.
- Node: `/opt/cpanel/ea-nodejs22/bin/node` (v22). The nvm default (18) is too old — always
  put ea-nodejs22 on PATH for server-side npm commands.
- Env vars come from `~/public_html/intranet/.env` on the server (Next.js loads it natively).
- Database: Supabase Postgres, project **`intranet`** (ref `qpnyysjakayualiqtvyf`, Sydney/`ap-southeast-2`) —
  its own separate project from staging (`mckqcwpnaouqrfnoxils`, see [DEPLOY-CPANEL-STAGING.md](./DEPLOY-CPANEL-STAGING.md)).
  `POSTGRES_URL` in `.env.production` connects as the `payload_app` role via the session pooler
  (`aws-0-ap-southeast-2.pooler.supabase.com:5432`, username `payload_app.qpnyysjakayualiqtvyf`). Schema
  changes go through `payload migrate` (never dev push, `push: false` in `payload.config.ts`) — see the
  "Database (Supabase)" section below. The `pre_departure` schema (department page-access, PNR queue, etc.)
  lives alongside `public` in the same project and isn't managed by Payload's migrations — see the note below.

## Redeploying an update
```bash
# 0. If this change added/edited a file in src/migrations/, apply it to production BEFORE
#    restarting Passenger (step 4) — production is a separate Postgres/Supabase project from
#    local/dev/staging (see .env.production's POSTGRES_URL). `payload migrate` only runs
#    migrations not yet recorded in production's own payload_migrations table, and every
#    migration in this repo is plain schema DDL (ALTER TABLE/CREATE TABLE, no data), so this
#    only ever applies the new change — nothing else. Check the migration's up() first though:
#    if it does more than raw DDL (e.g. a data backfill via the payload/req args), that runs also.
#    Apply to staging first and verify before running here. Use the guarded command below, not
#    a raw `env $(grep...)` — staging and production share the same pooler hostname, so the
#    guard's confirmation prompt (which prints the resolved Supabase project ref) is what
#    catches a copy-paste into the wrong env. See scripts/migrate-guard.mjs.
pnpm migrate:production:status   # review what's pending first
pnpm migrate:production          # then apply
# See "Database (Supabase)" below for what this does/doesn't touch, and how the pre_departure
# schema (not covered by payload migrate) rolls out separately.

# 1. Locally (NEXT_PUBLIC_SERVER_URL in .env must be https://intranet.complextravel.net)
pnpm build

# 2. Upload (never include intranet.db or .env — live versions rule)
rsync -az -e "ssh -i ~/.ssh/intranet_ssh" \
  --exclude node_modules --exclude .git --exclude '.next/cache' --exclude '.next/dev' \
  .next public server.cjs package.json next.config.ts redirects.ts tsconfig.json \
  complextravel@13.236.149.83:~/public_html/intranet/

# 3. If package.json changed, install on the server:
ssh -i ~/.ssh/intranet_ssh complextravel@13.236.149.83 \
  'export PATH=/opt/cpanel/ea-nodejs22/bin:$PATH && cd ~/public_html/intranet && npm install --omit=dev'

# 4. Restart Passenger
ssh -i ~/.ssh/intranet_ssh complextravel@13.236.149.83 'touch ~/public_html/intranet/tmp/restart.txt'

# 5. Verify
curl -s -o /dev/null -w "%{http_code}\n" https://intranet.complextravel.net/admin/login  # expect 200
```

## Gotcha: Turbopack hashed externals
The build references externals with hashed names (e.g. `@libsql/client-8ee936ec2ad7ab9b`,
`sharp-8cd8d3d835c259ad`, `pino-…`, `pino-pretty-…`). These are satisfied by symlinks in the
server's `node_modules`. **If the hashes change after a dependency upgrade**, find the new ones:

```bash
grep -rhoE '"[@a-zA-Z0-9/_.-]+-[0-9a-f]{16}"' .next/server/chunks/ssr/*.js | sort -u
```

then recreate the symlinks on the server, e.g.
`ln -sfn sharp sharp-<newhash>` inside `~/public_html/intranet/node_modules`
(and `ln -sfn client client-<newhash>` inside `~/public_html/intranet/node_modules/@libsql`).
Symptom if stale: 500s with `Failed to load external module <name>-<hash>` in
`~/public_html/intranet/stderr.log`.

## Database (Supabase) — schema/data changes
Production runs on its own Supabase project (`qpnyysjakayualiqtvyf`), separate from both staging and
local dev's Docker stack. Useful commands (via the Supabase CLI, linked with `supabase link --project-ref
qpnyysjakayualiqtvyf`):
- `pnpm migrate:production:status` / `pnpm migrate:production` — apply pending Payload schema migrations.
  Do this **before** deploying code that depends on a new migration, and only after the same migration
  has been applied to staging and verified there. These wrap `payload migrate*` in
  `scripts/migrate-guard.mjs`, which resolves the Supabase project ref from the env file and requires
  typing the env name to confirm — use these instead of exporting `POSTGRES_URL` by hand, since staging
  and production share the same pooler hostname and only the ref in the connection string tells them apart.
- `supabase config push` — push local `supabase/config.toml` auth/API settings (e.g. Google provider,
  redirect URLs, exposed schemas) to the linked project. Push from a temporary copy of `supabase/config.toml`
  with production-specific values (`site_url`, `additional_redirect_urls`, `redirect_uri` pointed at
  `https://qpnyysjakayualiqtvyf.supabase.co/auth/v1/callback`) — the checked-in config.toml is tuned for
  local Docker dev and must not be pushed as-is.
- The `pre_departure` schema (PNR queue, department page access, etc.) isn't part of Payload's migrations —
  changes to it are applied by hand via `psql`/the Supabase SQL editor and aren't tracked by `payload migrate`.
  Rollout order for a feature that changes this schema: write/test the SQL against local, then run the exact
  same SQL against staging's project (`mckqcwpnaouqrfnoxils`, see [DEPLOY-CPANEL-STAGING.md](./DEPLOY-CPANEL-STAGING.md)),
  verify, then run it again against this project (`qpnyysjakayualiqtvyf`) — there's no ledger for this
  schema, so each environment's SQL history is only what you've manually run against it. Since there's no
  automatic sync, track what's been applied where yourself (e.g. note it in the PR/commit).
- `payload migrate` never overrides existing data — it only runs the DDL/DML written in migration files not
  yet recorded in that environment's own `payload_migrations` table. Running it against staging then
  production applies the same schema structure to each; it does not copy data between environments, and
  each environment keeps its own rows. The one exception is if a migration's `up()` itself contains a data
  transform (e.g. a backfill) — that code runs against whatever data already exists in that environment.

## Debugging
- App errors: `~/public_html/intranet/stderr.log` on the server.
- 503 from the domain = Passenger couldn't spawn the app — check `stderr.log` first.
- Cloudflare fronts the domain; to test the origin directly:
  `curl -sk --resolve intranet.complextravel.net:443:13.236.149.83 https://intranet.complextravel.net/`
- Manual smoke test on the server:
  `cd ~/public_html/intranet && PORT=3111 /opt/cpanel/ea-nodejs22/bin/node server.cjs`
- **Mitigation: admin collection list renders empty / stderr.log shows `relation "..." does not exist`** —
  a schema migration under `src/migrations/` was applied locally but never run against this environment's
  Supabase project (this happened 2026-08-24 with `20260824_022450_add_feedback_cards_array`: the Pages
  admin list came back empty because Postgres queries on `pages`/`_pages_v` referenced tables the migration
  hadn't created yet here). Fix:
  ```bash
  pnpm migrate:production:status   # confirm which migration(s) are pending ("No" in the Ran column)
  pnpm migrate:production          # apply them
  ```
  No rebuild/redeploy needed to fix this — it's a DB-only fix. Verify by re-checking `stderr.log` for the
  `relation ... does not exist` error and reloading the affected admin collection page.

## One-time setup still pending
- Google OAuth: add `https://intranet.complextravel.net/api/auth/callback/google`
  to Authorized redirect URIs (and the domain to Authorized JavaScript origins) in
  Google Cloud Console, or Google SSO login will fail with redirect_uri_mismatch.

## Backups
No local SQLite file to worry about anymore — Supabase manages backups for its Postgres projects
(check the project's Settings → Backups in the dashboard for the retention window).
