# Deploying the Intranet (Staging) — cPanel / LiteSpeed / Passenger

Live at **https://staging.complextravel.net** (behind Cloudflare).
Server: `complextravel@13.236.149.83` (`server.complextravel.com.au`), SSH key `~/.ssh/intranet_ssh`.
App root on server: `/home/complextravel/public_html/intranet_staging` (also the subdomain's docroot).

This is the staging counterpart to [DEPLOY-CPANEL.md](./DEPLOY-CPANEL.md) — same server, same
process, different app root/subdomain/Passenger app. Keep the two `.env` files pointed at their
own domain and (if applicable) their own database so staging never touches production data.

## How it runs
- Registered as a cPanel Passenger app named **Staging** (`uapi PassengerApps list_applications`).
- LiteSpeed (Apache-compatible) spawns `app.js` (ESM) → imports `server.cjs` → boots Next.js.
- Node: `/opt/cpanel/ea-nodejs22/bin/node` (v22). The nvm default (18) is too old — always
  put ea-nodejs22 on PATH for server-side npm commands.
- Env vars come from `~/public_html/intranet_staging/.env` on the server (Next.js loads it natively).
- Database: Supabase Postgres, project **`intranet`** (ref `mckqcwpnaouqrfnoxils`, Sydney/`ap-southeast-2`) —
  its own separate project from production (`qpnyysjakayualiqtvyf`). `POSTGRES_URL` in `.env.staging`
  connects as the `payload_app` role via the session pooler (`aws-0-ap-southeast-2.pooler.supabase.com:5432`,
  username `payload_app.mckqcwpnaouqrfnoxils`) — same pattern as production, see [DEPLOY-CPANEL.md](./DEPLOY-CPANEL.md).
  Schema changes go through `payload migrate` (never dev push, `push: false` in `payload.config.ts`) — run
  `POSTGRES_URL=<staging URL> pnpm payload migrate` locally before deploying if a migration hasn't been
  applied to staging yet. The `pre_departure` schema (department page-access, PNR queue, etc.) lives
  alongside `public` in the same project and isn't managed by Payload's migrations — see the note below.

## Redeploying an update
```bash
# 1. Locally (NEXT_PUBLIC_SERVER_URL in .env must be https://staging.complextravel.net)
pnpm build

# 2. Upload (never include .env — the live version rules)
rsync -az -e "ssh -i ~/.ssh/intranet_ssh" \
  --exclude node_modules --exclude .git --exclude '.next/cache' \
  .next public server.cjs package.json next.config.ts redirects.ts tsconfig.json \
  complextravel@13.236.149.83:~/public_html/intranet_staging/

# 3. If package.json changed, install on the server:
ssh -i ~/.ssh/intranet_ssh complextravel@13.236.149.83 \
  'export PATH=/opt/cpanel/ea-nodejs22/bin:$PATH && cd ~/public_html/intranet_staging && npm install --omit=dev'

# 4. Restart Passenger
ssh -i ~/.ssh/intranet_ssh complextravel@13.236.149.83 'touch ~/public_html/intranet_staging/tmp/restart.txt'

# 5. Verify
curl -s -o /dev/null -w "%{http_code}\n" https://staging.complextravel.net/login  # expect 200
# /admin/login no longer exists post-Supabase-Auth migration — it correctly redirects to /login too.
```

## Gotcha: Turbopack hashed externals
The build references externals with hashed names (e.g. `@libsql/client-8ee936ec2ad7ab9b`,
`sharp-8cd8d3d835c259ad`, `pino-…`, `pino-pretty-…`). These are satisfied by symlinks in the
server's `node_modules`. **If the hashes change after a dependency upgrade**, find the new ones:

```bash
grep -rhoE '"[@a-zA-Z0-9/_.-]+-[0-9a-f]{16}"' .next/server/chunks/ssr/*.js | sort -u
```

then recreate the symlinks on the server, e.g.
`ln -sfn sharp sharp-<newhash>` inside `~/public_html/intranet_staging/node_modules`
(and `ln -sfn client client-<newhash>` inside `~/public_html/intranet_staging/node_modules/@libsql`).
Symptom if stale: 500s with `Failed to load external module <name>-<hash>` in
`~/public_html/intranet_staging/stderr.log`.

## Debugging
- App errors: `~/public_html/intranet_staging/stderr.log` on the server.
- 503 from the domain = Passenger couldn't spawn the app — check `stderr.log` first.
- Cloudflare fronts the domain; to test the origin directly:
  `curl -sk --resolve staging.complextravel.net:443:13.236.149.83 https://staging.complextravel.net/`
- Manual smoke test on the server:
  `cd ~/public_html/intranet_staging && PORT=3112 /opt/cpanel/ea-nodejs22/bin/node server.cjs`
  (use a different port than production's manual smoke test so both can run at once)

## Database (Supabase) — schema/data changes
Staging runs on its own Supabase project (`mckqcwpnaouqrfnoxils`), separate from both production and
local dev's Docker stack. Useful commands (via the Supabase CLI, linked with `supabase link --project-ref
mckqcwpnaouqrfnoxils`):
- `payload migrate:status` / `payload migrate` (with `POSTGRES_URL` pointed at staging) — apply pending
  Payload schema migrations. Do this **before** deploying code that depends on a new migration.
- `supabase config push` — push local `supabase/config.toml` auth/API settings (e.g. Google provider,
  redirect URLs, exposed schemas) to the linked project. Push from a temporary copy of `supabase/config.toml`
  with staging-specific values (`site_url`, `additional_redirect_urls`, `redirect_uri` pointed at
  `https://mckqcwpnaouqrfnoxils.supabase.co/auth/v1/callback`) — the checked-in config.toml is tuned for
  local Docker dev and must not be pushed as-is.
- The `pre_departure` schema (PNR queue, department page access, etc.) isn't part of Payload's migrations —
  changes to it are applied by hand via `psql`/the Supabase SQL editor and aren't tracked by `payload migrate`.

Google OAuth redirect URI (already configured): `https://mckqcwpnaouqrfnoxils.supabase.co/auth/v1/callback`
is registered in Google Cloud Console's Authorized redirect URIs — this is Supabase Auth's own callback,
not an app route, and doesn't change when the app's code changes. No Authorized JavaScript origin entry
is needed (server-side OAuth redirect flow, not a client-side JS SDK).

## Backups
No local SQLite file to worry about anymore — Supabase manages backups for its Postgres projects
(check the project's Settings → Backups in the dashboard for the retention window).
