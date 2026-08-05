/**
 * Copies the Pre-Departure tables from the Departure Supabase project into the intranet
 * project's `pre_departure` schema.
 *
 *   node scripts/pre-departure-copy.mjs
 *
 * Reads through supabase-js with the service-role key, which bypasses RLS without needing a
 * new database role on the source project, and writes over a direct pg connection because
 * `pre_departure` is not exposed to PostgREST.
 *
 * Two tables are deliberately not copied. `profiles` is replaced by Payload's users, and
 * Departure's `departments` by Payload's — so every column that referenced them is
 * translated on the way through (see USER_MAP / departmentMap below).
 *
 * Safe to re-run: every insert is ON CONFLICT DO NOTHING.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const source = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const target = new pg.Client({ connectionString: process.env.POSTGRES_URL })

/** profiles.id (uuid) -> Payload users.id. The bot kept its UUID, so it maps to itself. */
const USER_MAP = {
  '9b8ae4d3-7ed6-4acf-801e-20e71fd3d63a': '1',
  '9f56f394-7675-41fb-89a1-c3082d7e9bb9': '9f56f394-7675-41fb-89a1-c3082d7e9bb9',
}

/** Departure department name -> Payload department name. Marketing was created to match. */
const DEPARTMENT_NAMES = {
  Admin: 'Admin',
  'Air Consultants': 'Air Consultant',
  'IT Team': 'IT',
  Marketing: 'Marketing',
  Operations: 'Operations',
  'T&C Consultants': 'T+C Consultant',
}

/** Copied in FK order. `map` rewrites a row before it is inserted. */
const TABLES = [
  { name: 'sabre_tokens' },
  { name: 'signup_requests' },
  { name: 'pnr_deletions' },
  { name: 'report_it_flags' },
  { name: 'PNR_History' },
  { name: 'PNR_Note' },
  { name: 'PNR_Report_IT' },
  { name: 'pnr_ticket_compare_snapshot' },
  { name: 'pnr_ticket_compare_field' },
  { name: 'scan_batches', map: (r) => ({ ...r, started_by: USER_MAP[r.started_by] ?? null }) },
  { name: 'pnr_history' },
  { name: 'pnr_json' },
  { name: 'pnr_p3' },
  { name: 'pnr_ticket' },
  { name: 'pnr_queue', map: (r) => ({ ...r, added_by: USER_MAP[r.added_by] ?? null }) },
  { name: 'pnr_scan_outcomes' },
  { name: 'pnr_audit_log', map: (r) => ({ ...r, performed_by: USER_MAP[r.performed_by] ?? null }) },
  { name: 'pnr_moves', map: (r) => ({ ...r, moved_by: USER_MAP[r.moved_by] ?? null }) },
  { name: 'department_page_access', needsDepartments: true },
  { name: 'role_permissions', map: (r) => ({ ...r, updated_by: USER_MAP[r.updated_by] ?? null }) },
]

const quote = (name) => `"${name}"`

const insertRows = async (table, rows) => {
  if (!rows.length) return 0
  let inserted = 0
  for (const row of rows) {
    const columns = Object.keys(row)
    const values = columns.map((c) => {
      const v = row[c]
      // jsonb columns arrive as parsed objects; pg needs them serialised.
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
    })
    const placeholders = columns.map((_, i) => `$${i + 1}`)
    const { rowCount } = await target.query(
      `INSERT INTO pre_departure.${quote(table)} (${columns.map(quote).join(', ')})
       VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`,
      values,
    )
    inserted += rowCount ?? 0
  }
  return inserted
}

await target.connect()

// Build the Departure-department-UUID -> Payload-department-ID translation.
const { data: sourceDepartments } = await source.from('departments').select('id, name')
const { rows: payloadDepartments } = await target.query('SELECT id, name FROM public.departments')
const departmentMap = {}
for (const d of sourceDepartments ?? []) {
  const targetName = DEPARTMENT_NAMES[d.name]
  const match = payloadDepartments.find((p) => p.name === targetName)
  if (!match) throw new Error(`No Payload department for "${d.name}" (expected "${targetName}")`)
  departmentMap[d.id] = match.id
}
console.log(`department map: ${Object.keys(departmentMap).length} of ${sourceDepartments?.length} resolved\n`)

let total = 0
for (const { map, name, needsDepartments } of TABLES) {
  const { data, error } = await source.from(name).select('*')
  if (error) {
    console.error(`  ${name.padEnd(28)} READ FAILED: ${error.message}`)
    continue
  }
  let rows = data ?? []
  if (needsDepartments) {
    rows = rows.map((r) => ({ ...r, department_id: departmentMap[r.department_id] }))
    const unmapped = rows.filter((r) => r.department_id === undefined)
    if (unmapped.length) throw new Error(`${name}: ${unmapped.length} unmapped department_id`)
  }
  if (map) rows = rows.map(map)

  try {
    const n = await insertRows(name, rows)
    total += n
    console.log(`  ${name.padEnd(28)} ${String(n).padStart(3)} / ${rows.length}`)
  } catch (error) {
    console.error(`  ${name.padEnd(28)} WRITE FAILED: ${error.message}`)
  }
}

// Explicit IDs bypass the sequences, exactly as in the Payload import.
const { rows: sequences } = await target.query(`
  SELECT c.relname AS tbl,
         pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq,
         a.attname AS col
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped AND a.attnum > 0
  WHERE n.nspname = 'pre_departure' AND c.relkind = 'r'
    AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
`)
let reset = 0
for (const { col, seq, tbl } of sequences) {
  await target.query(
    `SELECT setval($1, GREATEST(COALESCE((SELECT max(${quote(col)}) FROM pre_departure.${quote(tbl)}), 0), 1))`,
    [seq],
  )
  reset += 1
}

console.log(`\n${total} rows copied, ${reset} sequences reset`)
await target.end()
