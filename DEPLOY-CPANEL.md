# Deploying the Intranet — cPanel / LiteSpeed / Passenger

Live at **https://intranet.complextravel.net**. Request path is
**Cloudflare (DNS-only/grey-clouded — responses carry no `cf-ray`) → nginx → LiteSpeed → Passenger → Node**.
Each hop has its own limits; see "Gotcha: Cookie header too large" below before blaming the app for a 400.
Server: `complextravel@13.236.149.83` (`server.complextravel.com.au`), SSH key `~/.ssh/intranet_ssh`.
App root on server: `/home/complextravel/public_html/intranet` (also the subdomain's docroot).

## How it runs
- Registered as a cPanel Passenger app named **Intranet** (`uapi PassengerApps list_applications`).
- nginx reverse-proxies to LiteSpeed (Apache-compatible), which spawns `app.js` (ESM) →
  imports `server.cjs` → boots Next.js. Both nginx and LiteSpeed can reject a request before
  it ever reaches Next.js — which means before middleware runs.
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

# 1. Locally — ALWAYS `build:production`, never a bare `pnpm build`.
#    Every NEXT_PUBLIC_* is inlined into the bundle at build time, so the build command
#    decides which Supabase project and which origin the shipped code talks to. A bare
#    `pnpm build` resolves env the way Next does by default, which means:
#      - .env's NEXT_PUBLIC_SERVER_URL is http://localhost:3000, and
#      - .env.local outranks .env.production, so a local staging .env.local silently wires
#        the production bundle to the staging Supabase project.
#    That happened on 2026-09-01: production ran against staging's auth project for ~20
#    minutes and signed-in users were bounced to /login. There was no build error.
#    build:production (scripts/build-env.mjs) moves .env.local aside for the build and then
#    greps .next/server + .next/static for the expected project ref, failing the build if the
#    intended ref is missing or the other environment's ref is present. Look for:
#      env check: .env.production -> qpnyysjakayualiqtvyf in N bundle(s), mckqcwpnaouqrfnoxils in 0
#      ✓ bundle matches the intended environment
pnpm build:production

# 2. Upload (never include intranet.db or .env — live versions rule)
#    Note there is no --delete: files removed from a build stay on the server. That is
#    deliberate (it avoids yanking assets out from under in-flight page loads), but it means
#    a bad build leaves contaminated chunks behind after you redeploy a good one. After
#    fixing a bad deploy, confirm with the grep in step 5.
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
curl -s -o /dev/null -w "%{http_code}\n" https://intranet.complextravel.net/admin   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://intranet.complextravel.net/login   # expect 200
# /admin/login returns 307 to /login?redirect=/admin — that is correct, not a failure.

# Confirm the deployed bundle talks to the right Supabase project (catches both a mis-built
# bundle and contaminated leftovers from a previous bad deploy — see step 2 on --delete):
ssh -i ~/.ssh/intranet_ssh complextravel@13.236.149.83 \
  'cd ~/public_html/intranet && \
   printf "prod: "    && grep -rl qpnyysjakayualiqtvyf .next/server .next/static --include="*.js" | grep -v "\.map$" | wc -l && \
   printf "staging: " && grep -rl mckqcwpnaouqrfnoxils .next/server .next/static --include="*.js" | grep -v "\.map$" | wc -l'
# expect a non-zero prod count and staging = 0. Delete any staging-contaminated file by hand.
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

## Gotcha: Cookie header too large (400 Bad Request, per-user)
**Symptom:** one user gets `400 Bad Request` on *every* page of the site, including static
assets, while everyone else is fine. Clearing that browser's cookies fixes it instantly.
Nothing appears in `stderr.log` — the request never reaches the app.

**Cause:** the browser's `Cookie:` header outgrew a limit at one of the hops in front of Node.
Each hop caps the whole header line (splitting into more, smaller cookies does **not** help).
Measured against production by sending padded cookies:

| hop | limit | how to identify it |
| --- | --- | --- |
| nginx | was 8,190 B (`large_client_header_buffers 4 8k` default) — **raised to 32k** 2026-09-01 via `/etc/nginx/conf.d/large_headers.conf` | plain nginx 400 page |
| LiteSpeed | ~15,875 B (`maxReqHeaderSize`, default and likely max 16380) | 400 page reading **"It is not a valid request!"** |
| Node | 16 KB default — **raised to 64 KB** via `createServer({ maxHeaderSize })` in `server.cjs` | bare 400, connection closed |
| Cloudflare | not in the path (grey-clouded) | would show `Server: cloudflare` |

Find the current ceiling and the responsible hop:
```bash
for n in 8000 16000 24000 32000; do
  printf "%sB -> " $n
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Cookie: probe=$(python3 -c "print('x'*$n)")" https://intranet.complextravel.net/login
done
# then read the error body at a failing size to see which hop wrote it:
curl -s -H "Cookie: probe=$(python3 -c "print('x'*20000)")" https://intranet.complextravel.net/login
```

**Why it accumulates:** one Supabase SSO session is ~4.2 KB — a ~1,650 B user object (identities
included), a ~1,350 B JWT that re-embeds `user_metadata`, base64 (+33%), split across `.0`/`.1`.
Against the old 8 KB budget that left room for barely one session, so a single leftover cookie
tipped a user over. The leftovers come from Auth.js cookies predating the Supabase migration,
`sb-*` cookies belonging to a *different* project ref, and orphaned chunks of the current
session (see `expireStaleAuthCookies` in `src/middleware.ts`).

**The trap that made three earlier fixes look broken:** cookie cleanup lives in middleware, but
a browser that has already crossed the limit is rejected upstream — no response is generated, so
no `Set-Cookie` deletion is ever sent, and the browser keeps accumulating with nothing able to
prune it. Every path on the host fails, so there is no page the user can load to get fixed.
**Raising the upstream buffer is what makes the middleware cleanup reachable**; the two halves
only work together. (Commits 48cf6bc / e496348 / c3be18c added the cleanup but were only ever
deployed to staging — always confirm a fix is actually on production, see step 5.)

**Recovering a user who is stuck right now:** they must clear site data for
intranet.complextravel.net by hand (Chrome: lock icon → Cookies and site data → Manage →
delete). Nothing can be done for them server-side until their request gets through.

## Gotcha: SSH bans itself mid-deploy
cPHulk/fail2ban on this box bans the source IP after repeated SSH connections — an rsync
followed by a couple of `ssh` commands is enough, so a deploy can lock you out *between*
uploading and restarting Passenger. Symptom is `ssh: connect to host ... port 22: Operation
timed out` when it worked a minute earlier (`nc -z 13.236.149.83 22` to confirm). It clears on
its own after a while. From the server's root console:
```bash
/usr/local/cpanel/bin/cphulk_pd --flush
fail2ban-client set sshd unbanip <your-ip>
```
Batch server-side work into a single `ssh` invocation to avoid tripping it.

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
