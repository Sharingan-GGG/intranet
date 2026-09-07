#!/usr/bin/env bash
# Drives Payload's job queue. `scheduleExpiry` (src/collections/Posts/hooks/scheduleExpiry.ts)
# only *queues* a `schedulePublish` job when a post's Expiry Date is set — nothing
# unpublishes the post until something calls this endpoint, so without this script
# expiry dates silently never fire.
#
# Install as a cron on the server (every 5 minutes):
#   */5 * * * * /home/complextravel/public_html/intranet/scripts/run-jobs.sh >> ~/logs/run-jobs.log 2>&1
#
# CRON_SECRET is read from an env file rather than written into the crontab line,
# because crontabs are readable by anyone with shell access to the account, and is
# handed to curl over stdin rather than argv so it never appears in `ps` output.
#
# Usage: run-jobs.sh [env-file]   (defaults to .env alongside the repo root)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$REPO_ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "run-jobs: env file not found: $ENV_FILE" >&2
  exit 1
fi

# Last assignment wins, matching dotenv; tolerates optional surrounding quotes.
read_env() {
  sed -nE "s/^[[:space:]]*$1=[\"']?(.*[^\"'])[\"']?[[:space:]]*\$/\1/p" "$ENV_FILE" | tail -1
}

CRON_SECRET="$(read_env CRON_SECRET)"
BASE_URL="${RUN_JOBS_URL:-$(read_env NEXT_PUBLIC_SERVER_URL)}"

if [[ -z "$CRON_SECRET" ]]; then
  echo "run-jobs: CRON_SECRET is empty in $ENV_FILE" >&2
  exit 1
fi
if [[ -z "$BASE_URL" ]]; then
  echo "run-jobs: NEXT_PUBLIC_SERVER_URL is empty in $ENV_FILE" >&2
  exit 1
fi

printf '[%s] running jobs against %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$BASE_URL"

printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
  | curl -fsS -m 120 -K - "${BASE_URL%/}/api/payload-jobs/run"

printf '\n'
