/**
 * Creates the Payload schema in the database named by POSTGRES_URL, without importing
 * anything.
 *
 *   pnpm db:push
 *
 * Simply initialising Payload is enough: the Postgres adapter runs Drizzle's dev push
 * from connect() whenever `push` is not disabled and NODE_ENV is not production. The
 * point of doing it as its own step is to be able to check the tables and enums landed
 * before `pnpm db:import` starts writing ~90 documents into them — the migration targets
 * a remote database, so a botched half-import is expensive to unpick.
 *
 * The `payload migrate:*` commands deliberately skip the push, which is why they cannot
 * stand in for this.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set — refusing to run, this would push to SQLite.')
}

const payload = await getPayload({ config })

const pool = (payload.db as unknown as { pool: { query: Function } }).pool
const { rows: tables } = await pool.query(
  `SELECT count(*)::int AS count FROM information_schema.tables
   WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`,
)
const { rows: enums } = await pool.query(
  `SELECT count(DISTINCT t.typname)::int AS count FROM pg_type t
   JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = current_schema() AND t.typtype = 'e'`,
)

console.log(`\nschema pushed: ${tables[0].count} tables, ${enums[0].count} enums`)
process.exit(0)
