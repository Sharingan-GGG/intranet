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
- Database: SQLite at `/home/complextravel/public_html/intranet/intranet.db` — **back it up; never overwrite it.**

## Redeploying an update
```bash
# 1. Locally (NEXT_PUBLIC_SERVER_URL in .env must be https://intranet.complextravel.net)
pnpm build

# 2. Upload (never include intranet.db or .env — live versions rule)
rsync -az -e "ssh -i ~/.ssh/intranet_ssh" \
  --exclude node_modules --exclude .git --exclude '.next/cache' \
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

## Debugging
- App errors: `~/public_html/intranet/stderr.log` on the server.
- 503 from the domain = Passenger couldn't spawn the app — check `stderr.log` first.
- Cloudflare fronts the domain; to test the origin directly:
  `curl -sk --resolve intranet.complextravel.net:443:13.236.149.83 https://intranet.complextravel.net/`
- Manual smoke test on the server:
  `cd ~/public_html/intranet && PORT=3111 /opt/cpanel/ea-nodejs22/bin/node server.cjs`

## One-time setup still pending
- Google OAuth: add `https://intranet.complextravel.net/api/auth/callback/google`
  to Authorized redirect URIs (and the domain to Authorized JavaScript origins) in
  Google Cloud Console, or Google SSO login will fail with redirect_uri_mismatch.
- Backups: ensure `~/public_html/intranet/intranet.db` is covered by cPanel backups or a cron copy.
