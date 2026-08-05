/**
 * Replays scripts/.migration/export.json into the Postgres database named by POSTGRES_URL.
 *
 *   pnpm db:import
 *
 * Documents go back in through Payload's own create(), so rich text becomes jsonb, select
 * fields become enums and booleans become real booleans without any hand-written casting.
 * `allowIDOnCreate` (set in payload.config.ts) keeps the original IDs, which is what keeps
 * every *_rels row pointing at the right document.
 */
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set — refusing to run, this would import into SQLite.')
}

// Ordered so a document's relationship targets already exist by the time it is created.
// Slugs absent from the config are skipped, and anything left over runs at the end.
const ORDER = [
  'departments',
  'permissions',
  'roles',
  'payload-folders',
  'users',
  'media',
  'categories',
  'time-zones',
  'quick-links',
  'knowledge-base',
  'events',
  'edms',
  'forms',
  'form-submissions',
  'posts',
  'pages',
  'redirects',
]

const data = JSON.parse(await fs.readFile(path.resolve('scripts/.migration/export.json'), 'utf8'))
const payload = await getPayload({ config })
const pool = (payload.db as unknown as { pool: { query: Function } }).pool

const collections = payload.collections as Record<
  string,
  { config?: { auth?: unknown; fields?: unknown } }
>
const isAuthCollection = (slug: string) => Boolean(collections[slug]?.config?.auth)

/**
 * Fields a hook rebuilds on read, which must not be written back.
 *
 * `posts.populatedAuthors` is a cache maintained by the populateAuthors hook, and each of
 * its array rows takes the author's user ID as the row's own ID. Two posts sharing an author
 * therefore carry the same row ID, so the second one collides on the array table's primary
 * key — reported by Payload as "The following field is invalid: id".
 */
const DERIVED_FIELDS: Record<string, string[]> = {
  posts: ['populatedAuthors'],
}

const createDoc = async (slug: string, doc: Record<string, unknown>) => {
  const rest = { ...doc }
  for (const name of DERIVED_FIELDS[slug] ?? []) delete rest[name]
  // Payload rejects a create() into an auth-enabled collection without a password, and the
  // export carries none by design: ten of the eleven users are Google-SSO-only, and the
  // eleventh's stored hash cannot round-trip through create() either. A throwaway password
  // gets it past validation; restoreCredentials() below replaces it with the real hash, or
  // clears it for the SSO-only users so no usable local login is left behind.
  if (isAuthCollection(slug) && !rest.password) {
    rest.password = randomBytes(24).toString('base64url')
  }
  await payload.create({
    collection: slug as never,
    // `_status` stays in the data on purpose. It is a real field, and it — not the `draft`
    // argument — is what publishes a document. Stripping it and passing `draft: false`
    // instead leaves Payload to default the status, which silently imports every page and
    // post as a draft, including the `home` page the whole frontend renders from.
    data: rest as never,
    draft: rest._status === 'draft',
    overrideAccess: true,
    // These hooks call revalidatePath, which has no request context in a script.
    context: { disableRevalidate: true },
  })
}

/**
 * Media is inserted as raw rows — see the note in db-export.ts.
 *
 * The column names come from SQLite and are trusted to match Postgres, which holds for
 * Payload's shared snake_case naming (including oddities like `thumbnail_u_r_l`). Values
 * are passed as untyped parameters so Postgres resolves them against the target column:
 * that is what converts the `caption` JSON string to jsonb and the ISO date strings to
 * timestamptz. A name that does *not* match would otherwise abort the run with rows
 * already committed, so the whole set is checked up front and inserted in one transaction.
 */
const importMedia = async () => {
  const rows: Record<string, unknown>[] = data.mediaRows ?? []
  if (!rows.length) {
    console.log('  media: 0 (raw rows)')
    return
  }

  const { rows: actual } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'media'`,
  )
  const known = new Set(actual.map((column: { column_name: string }) => column.column_name))
  if (!known.size) {
    throw new Error('The `media` table does not exist yet — boot the dev server first so Payload pushes the schema.')
  }
  const unknown = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (column) => !known.has(column),
  )
  if (unknown.length) {
    throw new Error(
      `Exported media columns missing from Postgres: ${unknown.join(', ')}.\n` +
        `The SQLite and Postgres adapters disagree on these names; map them in db-export.ts before retrying.`,
    )
  }

  await pool.query('BEGIN')
  try {
    for (const row of rows) {
      const columns = Object.keys(row).filter((key) => row[key] !== null)
      const values = columns.map((key) => row[key])
      const placeholders = columns.map((_, index) => `$${index + 1}`)
      try {
        await pool.query(
          `INSERT INTO media (${columns.map((column) => `"${column}"`).join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values,
        )
      } catch (error) {
        throw new Error(
          `media id=${String(row.id)} (${String(row.filename)}) failed: ${(error as Error).message}`,
          { cause: error },
        )
      }
    }
    await pool.query('COMMIT')
  } catch (error) {
    await pool.query('ROLLBACK')
    throw error
  }
  console.log(`  media: ${rows.length} (raw rows)`)
}

const slugs = [
  ...ORDER.filter((slug) => slug === 'media' || slug in data.collections),
  ...Object.keys(data.collections).filter((slug) => !ORDER.includes(slug)),
]

// Self-references (categories.parent) and mutually-referencing pairs can't be satisfied on
// the first pass, so failures are collected and retried once everything else exists.
const deferred: { doc: Record<string, unknown>; slug: string }[] = []

for (const slug of slugs) {
  if (slug === 'media') {
    await importMedia()
    continue
  }
  let created = 0
  let postponed = 0
  for (const doc of data.collections[slug] ?? []) {
    try {
      await createDoc(slug, doc)
      created += 1
    } catch {
      // Not reported here: a genuine schema error looks identical to a benign ordering
      // miss at this point. Whatever is still broken after the retry pass below is logged.
      deferred.push({ doc, slug })
      postponed += 1
    }
  }
  console.log(`  ${slug}: ${created}${postponed ? ` (${postponed} deferred)` : ''}`)
}

/**
 * Names of the relationship and upload fields a document carries at its own level.
 *
 * Tabs, rows and collapsibles are transparent — their fields live directly on the document,
 * so they are walked into. Groups, arrays and blocks nest data under their own key and are
 * left alone; nothing in this config puts a cycle-forming relationship inside one.
 */
const relationFieldNames = (slug: string): string[] => {
  const walk = (fields: Record<string, unknown>[]): string[] =>
    fields.flatMap((field) => {
      if (Array.isArray(field.tabs)) return walk(field.tabs as Record<string, unknown>[])
      if (Array.isArray(field.fields)) return walk(field.fields as Record<string, unknown>[])
      const type = field.type as string
      return (type === 'relationship' || type === 'upload') && typeof field.name === 'string'
        ? [field.name]
        : []
    })
  const fields = collections[slug]?.config?.fields
  return Array.isArray(fields) ? walk(fields as Record<string, unknown>[]) : []
}

if (deferred.length) {
  console.log(`\nretrying ${deferred.length} deferred document(s)...`)

  // Repeat while progress is being made: a chain like roles -> departments -> users needs
  // one pass per link, and the chain length is not known ahead of time.
  let pending = deferred
  while (pending.length) {
    const stillFailing: typeof pending = []
    for (const { doc, slug } of pending) {
      try {
        await createDoc(slug, doc)
      } catch {
        stillFailing.push({ doc, slug })
      }
    }
    if (stillFailing.length === pending.length) break
    pending = stillFailing
  }

  // Whatever is left is a true cycle that no ordering can satisfy — departments.lead points
  // at a user whose department points back, so neither can be created with its references
  // intact. Create the document without them, then patch them in once the targets exist.
  const toPatch: typeof pending = []
  for (const { doc, slug } of pending) {
    const stripped = { ...doc }
    for (const name of relationFieldNames(slug)) delete stripped[name]
    try {
      await createDoc(slug, stripped)
      toPatch.push({ doc, slug })
    } catch (error) {
      console.error(`  FAILED ${slug} id=${String(doc.id)}: ${(error as Error).message}`)
    }
  }
  if (toPatch.length) {
    console.log(`  broke ${toPatch.length} circular reference(s), restoring relationships...`)
  }

  let patched = 0
  for (const { doc, slug } of toPatch) {
    const { id, ...rest } = doc
    for (const name of DERIVED_FIELDS[slug] ?? []) delete rest[name]
    try {
      await payload.update({
        collection: slug as never,
        id: id as string,
        data: rest as never,
        draft: rest._status === 'draft',
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      patched += 1
    } catch (error) {
      console.error(`  FAILED patch ${slug} id=${String(id)}: ${(error as Error).message}`)
    }
  }
  if (toPatch.length) {
    console.log(`  relationships restored: ${patched}/${toPatch.length}`)
  }
}

for (const [slug, doc] of Object.entries(data.globals ?? {})) {
  await payload.updateGlobal({
    slug: slug as never,
    data: doc as never,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
  console.log(`  global ${slug}: ok`)
}

// Password hashes can't travel through create(); restore them so password login still works.
const credentials: { hash: string; id: string | number; salt: string }[] = data.credentials ?? []
let restored = 0
for (const credential of credentials) {
  const { rowCount } = await pool.query('UPDATE users SET hash = $1, salt = $2 WHERE id = $3', [
    credential.hash,
    credential.salt,
    String(credential.id),
  ])
  restored += rowCount ?? 0
}
if (restored !== credentials.length) {
  console.error(
    `  WARNING: restored ${restored} of ${credentials.length} credential(s) — a user row is missing.`,
  )
}

// Everyone else had no hash in SQLite (db-export.ts selects only non-empty ones), so drop
// the throwaway password createDoc() had to invent rather than leave a local login open.
const ids = credentials.map((credential) => String(credential.id))
const { rowCount: cleared } = await pool.query(
  `UPDATE users SET hash = NULL, salt = NULL
   WHERE hash IS NOT NULL AND id <> ALL($1::text[])`,
  [ids],
)
console.log(`  credentials restored: ${restored}/${credentials.length}, cleared: ${cleared ?? 0}`)

// Explicit IDs bypass the sequences, so they'd hand out colliding IDs on the next insert.
//
// Driven off pg_class rather than information_schema.columns: Postgres may evaluate
// pg_get_serial_sequence() before the schema filter, and resolving an unqualified name that
// only exists in another schema (extensions.pg_stat_statements_info) aborts the query.
const { rows: sequences } = await pool.query(`
  SELECT c.relname AS table_name,
         pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), 'id') AS sequence
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id' AND NOT a.attisdropped
  WHERE n.nspname = current_schema()
    AND c.relkind = 'r'
`)
let reset = 0
for (const { sequence, table_name } of sequences) {
  if (!sequence || !/^[a-z0-9_]+$/.test(table_name)) continue
  await pool.query(
    `SELECT setval($1, GREATEST(COALESCE((SELECT MAX(id) FROM "${table_name}"), 0), 1))`,
    [sequence],
  )
  reset += 1
}
console.log(`  sequences reset: ${reset}`)

console.log('\nimport complete')
process.exit(0)
