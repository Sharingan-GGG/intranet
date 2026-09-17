/**
 * Applies (or prints) the declarative `audit` schema in dependency order.
 *
 * The `audit` schema follows the same convention as `pre_departure`: it is NOT
 * part of Payload's migrations (Payload owns `public` only, and the config has
 * push:false). The checked-in files under supabase/database/schemas/audit are
 * the record; this script just orders and runs them.
 *
 *   node -r dotenv/config scripts/audit-apply-schema.mjs --print \
 *     dotenv_config_path=.env.local          # emit the bundle, run nothing
 *
 *   node -r dotenv/config scripts/audit-apply-schema.mjs --apply \
 *     dotenv_config_path=.env.local          # run it, in one transaction
 *
 * Use --print to produce the block to paste into the production SQL editor.
 * Run it alone: staging's pooler is pool_size 15 and stacked scripts exhaust it,
 * which surfaces as misleading connection errors rather than a clear limit.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = join(ROOT, 'supabase/database/schemas/audit')

// Dependency order: schema, then enums, then tables (parents before children),
// then views over the finished tables.
const FILES = [
  'schema.sql',
  'types/yes_no.sql',
  'types/schedule_type.sql',
  'types/status_type.sql',
  'tables/seo_agent_tracker.sql',
  'tables/audit_runs.sql',
  'tables/audit_issues.sql',
  'tables/content_audits.sql',
  'tables/seo_site_content_audit.sql',
  'tables/drift_baselines.sql',
  'tables/drift_events.sql',
  'tables/ga4_properties.sql',
  'tables/ga4_daily.sql',
  'views/tracker_latest_run.sql',
]

const bundle = FILES.map((f) => `-- ${'='.repeat(68)}\n-- ${f}\n-- ${'='.repeat(68)}\n\n${readFileSync(join(BASE, f), 'utf8').trim()}\n`).join('\n')

const mode = process.argv.find((a) => a === '--print' || a === '--apply')
if (!mode) {
  console.error('Pass --print or --apply.')
  process.exit(1)
}

if (mode === '--print') {
  process.stdout.write(`BEGIN;\n\n${bundle}\nCOMMIT;\n`)
  process.exit(0)
}

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('POSTGRES_URL is not set. Pass dotenv_config_path=.env.local (or .env.staging).')
  process.exit(1)
}

const { default: pg } = await import('pg')
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const { rows: host } = await client.query('select current_user, current_database()')
console.log(`Connected as ${host[0].current_user} to ${connectionString.split('@')[1]?.split('/')[0]}`)

try {
  await client.query('BEGIN')
  await client.query(bundle)
  await client.query('COMMIT')
  console.log(`Applied ${FILES.length} files.`)
} catch (err) {
  await client.query('ROLLBACK')
  console.error(`Rolled back: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
