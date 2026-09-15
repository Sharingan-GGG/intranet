import 'server-only'

import { Pool, type QueryResultRow } from 'pg'

/**
 * Direct Postgres access for the `audit` schema.
 *
 * Not supabase-js. PostgREST refuses to serve a schema that is not in its
 * exposed list, and on this project the saved config and the running service
 * disagree — `audit` is configured but PGRST106 persists through a reload and a
 * full restart. Going straight to Postgres sidesteps that entirely, and it
 * costs nothing here: every caller is server-side, `payload_app` **owns** every
 * table in the schema so it bypasses RLS, and Payload itself already reaches
 * the database this way. It also takes the recurring exposed-schema trap off
 * this feature permanently.
 *
 * One pool for the process, deliberately small. Staging runs through the
 * session pooler at `pool_size 15` shared with Payload and any `payload run`
 * script; opening a client per request exhausts it and surfaces as misleading
 * connection errors rather than a clear limit.
 */
declare global {
  // eslint-disable-next-line no-var
  var __auditPool: Pool | undefined
}

function auditPool(): Pool {
  // Reused across hot reloads in dev, where module state is otherwise discarded
  // on every edit and would leak a pool each time.
  if (!global.__auditPool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('POSTGRES_URL is not set — the Audit Hub cannot reach the database.')
    }
    global.__auditPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return global.__auditPool
}

/**
 * Run one query against the `audit` schema.
 *
 * Every table is referenced schema-qualified (`audit.x`) rather than by setting
 * a search_path: the pool is shared, and a `SET search_path` on one pooled
 * connection would leak into whatever ran on it next.
 */
export async function auditQuery<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await auditPool().query<T>(text, values)
  return result.rows
}

/** Run several statements as one unit — used by the batch queue writes. */
export async function auditTransaction<T>(fn: (q: typeof auditQuery) => Promise<T>): Promise<T> {
  const client = await auditPool().connect()
  const scoped = async <R extends QueryResultRow>(text: string, values: unknown[] = []) =>
    (await client.query<R>(text, values)).rows
  try {
    await client.query('BEGIN')
    const out = await fn(scoped as typeof auditQuery)
    await client.query('COMMIT')
    return out
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * `numeric` columns come back from pg as strings, not numbers — `overall` and
 * `delta` both. Every read of them goes through here so a score never reaches
 * the UI as "76" and sorts as a string.
 */
export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : null
}
