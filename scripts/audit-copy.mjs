/**
 * Copies the SEO/GEO Audit Hub's data out of the retired standalone Supabase
 * project into the intranet's `audit` schema.
 *
 * Same shape as scripts/pre-departure-copy.mjs: read the source over PostgREST
 * with its service-role key, write to the target over a direct `pg` connection
 * (the target schema is not exposed to PostgREST for anon, and we want the
 * writes to go through payload_app anyway).
 *
 *   AUDIT_SOURCE_URL=https://<ref>.supabase.co \
 *   AUDIT_SOURCE_SERVICE_KEY=<service_role key> \
 *   node -r dotenv/config scripts/audit-copy.mjs dotenv_config_path=.env.local
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING, so a re-run after a
 * partial copy fills the gaps rather than erroring. Pass --dry-run to read and
 * report without writing anything.
 *
 * Run it alone. Staging's pooler is pool_size 15 and stacked scripts exhaust
 * it, which surfaces as misleading connection errors rather than a clear limit.
 */
import pg from 'pg'

const SOURCE_URL = process.env.AUDIT_SOURCE_URL
const SOURCE_KEY = process.env.AUDIT_SOURCE_SERVICE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SOURCE_URL || !SOURCE_KEY) {
  console.error('Set AUDIT_SOURCE_URL and AUDIT_SOURCE_SERVICE_KEY (from the old project).')
  process.exit(1)
}

/**
 * The old portal stored assignments as bare first names against a hardcoded
 * roster. Those names map exactly onto the intranet's Marketing and IT
 * departments, so they become emails here — email is already the join key
 * between Supabase Auth and Payload users everywhere else in this codebase,
 * and unlike a first name it survives someone changing their display name.
 */
const ASSIGNEE_EMAILS = {
  Anjelica: 'anjelica@complextravel.com.au',
  Blake: 'blake@complextravel.com.au',
  Emanuela: 'emanuela@complextravel.com.au',
  Marc: 'm.persico@complextravel.com.au',
  Yusuf: 'yusuf@roundabouttravel.com.au',
  Gio: 'giovanni@complextravel.com.au',
  John: 'john@complextravel.com.au',
  Kenny: 'kenny@roundabouttravel.com.au',
  Madelynn: 'madelynn@complextravel.com.au',
  // Two audit_issues rows carry 'Lynn'; the only match in either department.
  Lynn: 'madelynn@complextravel.com.au',
}

const unmapped = new Set()

function toEmails(names) {
  if (!names) return null
  const out = []
  for (const name of names) {
    const email = ASSIGNEE_EMAILS[name]
    if (email) {
      if (!out.includes(email)) out.push(email)
    } else {
      unmapped.add(name)
    }
  }
  return out.length ? out : null
}

const identity = (row) => row

/** Copy order matters: parents before children, for the two foreign keys. */
const TABLES = [
  {
    name: 'seo_agent_tracker',
    conflict: 'id',
    columns: [
      'id', 'url', 'Full Scan', 'agent_content', 'agent_schema', 'agent_technical',
      'agent_performance', 'agent_geo', 'agent_sxo', 'agent_drift', 'agent_semrush',
      'schedule', 'executed_date', 'status', 'created_at', 'Domain',
      'started_at', 'finished_at', 'error', 'overall', 'assigned',
    ],
    transform: (row) => ({ ...row, assigned: toEmails(row.assigned) }),
  },
  {
    name: 'audit_runs',
    conflict: 'id',
    columns: ['id', 'url', 'run_type', 'agents_run', 'overall', 'dimensions', 'report', 'delta', 'ran_at', 'tracker_id'],
    transform: identity,
  },
  {
    name: 'audit_issues',
    conflict: 'id',
    columns: ['id', 'run_id', 'priority', 'dimension', 'title', 'recommendation', 'created_at', 'assign_role', 'fingerprint', 'done_at'],
    transform: (row) => ({ ...row, assign_role: toEmails(row.assign_role) }),
  },
  {
    name: 'content_audits',
    conflict: 'id',
    columns: ['id', 'url', 'domain', 'status', 'error', 'queued_at', 'started_at', 'finished_at', 'report', 'summary_report', 'archived'],
    transform: identity,
  },
  {
    name: 'seo_site_content_audit',
    conflict: 'id',
    columns: ['id', 'domain', 'url', 'status', 'schedule', 'executed_date', 'type', 'created_at', 'overall', 'report'],
    transform: identity,
  },
  {
    name: 'drift_baselines',
    conflict: 'url',
    columns: ['url', 'baseline', 'captured_at', 'updated_at'],
    transform: identity,
  },
  {
    name: 'drift_events',
    conflict: 'id',
    columns: ['id', 'url', 'event_type', 'field', 'old_value', 'new_value', 'severity', 'detected_at'],
    transform: identity,
  },
]

const PAGE_SIZE = 200

/** PostgREST caps a response at max_rows, so page explicitly rather than trusting one request. */
async function readAll(table) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(`${SOURCE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SOURCE_KEY,
        Authorization: `Bearer ${SOURCE_KEY}`,
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        'Range-Unit': 'items',
      },
    })
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

/** jsonb and text[] both need to go down the wire as something pg understands. */
function toParam(value) {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

async function copyTable(client, spec) {
  const rows = await readAll(spec.name)
  if (!rows.length) {
    console.log(`  ${spec.name.padEnd(24)} source empty, nothing to do`)
    return { read: 0, written: 0 }
  }
  if (DRY_RUN) {
    // Still run the transform: validating the assignee name mapping is the
    // main reason to dry-run at all.
    rows.forEach(spec.transform)
    console.log(`  ${spec.name.padEnd(24)} ${String(rows.length).padStart(4)} rows read (dry run)`)
    return { read: rows.length, written: 0 }
  }

  const cols = spec.columns.map((c) => `"${c}"`).join(', ')
  const placeholders = spec.columns.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO audit.${spec.name} (${cols}) VALUES (${placeholders}) ON CONFLICT ("${spec.conflict}") DO NOTHING`

  let written = 0
  for (const raw of rows) {
    const row = spec.transform(raw)
    const values = spec.columns.map((c) => toParam(row[c]))
    const res = await client.query(sql, values)
    written += res.rowCount
  }
  console.log(`  ${spec.name.padEnd(24)} ${String(rows.length).padStart(4)} read, ${String(written).padStart(4)} inserted`)
  return { read: rows.length, written }
}

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('POSTGRES_URL is not set. Pass dotenv_config_path=.env.local (or .env.staging / .env.production).')
  process.exit(1)
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
console.log(`Source: ${SOURCE_URL}`)
console.log(`Target: ${connectionString.split('@')[1]?.split('/')[0]}${DRY_RUN ? '  (dry run)' : ''}\n`)

let totalRead = 0
let totalWritten = 0
try {
  for (const spec of TABLES) {
    const { read, written } = await copyTable(client, spec)
    totalRead += read
    totalWritten += written
  }
  console.log(`\n${totalRead} rows read, ${totalWritten} inserted.`)
  if (unmapped.size) {
    console.warn(`\nUnmapped assignee names (left out of the email arrays): ${[...unmapped].join(', ')}`)
    process.exitCode = 1
  }
} catch (err) {
  console.error(`\nFailed: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
