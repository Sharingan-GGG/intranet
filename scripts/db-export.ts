/**
 * Dumps the local SQLite database to JSON for scripts/db-import.ts to replay into Postgres.
 *
 *   pnpm db:export
 *
 * Reading through Payload rather than the raw tables means every document comes out in
 * field shape (rich text as objects, relationships as IDs), so the import can hand it
 * straight back to Payload and let the Postgres adapter pick the right column types.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'

// payload.config chooses Postgres whenever POSTGRES_URL is set. This script only ever
// reads the old SQLite file, so the variable has to be cleared before the config module
// is evaluated — hence the dynamic import below rather than a top-level one.
delete process.env.POSTGRES_URL
const { default: config } = await import('@payload-config')

const OUT_DIR = path.resolve('scripts/.migration')

const SKIP = new Set([
  // Payload rebuilds these itself; they hold no content worth moving.
  'payload-preferences',
  'payload-locked-documents',
  'payload-jobs',
  'payload-migrations',
  'payload-kv',
  // The search plugin regenerates these as posts are created during the import.
  'search',
  // Exported as raw rows further down: Payload's create() insists on the file being
  // present and renames on filename conflicts, which would break every media reference.
  'media',
])

const payload = await getPayload({ config })

const collections: Record<string, unknown[]> = {}
for (const slug of Object.keys(payload.collections)) {
  if (SKIP.has(slug)) continue
  const { docs } = await payload.find({
    collection: slug as never,
    depth: 0, // keep relationships as IDs instead of populated objects
    // NOT `draft: true`: that joins against the _v tables, so any document with no version
    // row at all is silently dropped (the `home` page has none). The main table already
    // holds each document's current content and _status, drafts included.
    limit: 0,
    overrideAccess: true,
    pagination: false,
  })
  collections[slug] = docs
  console.log(`  ${slug}: ${docs.length}`)
}

const globals: Record<string, unknown> = {}
for (const global of payload.config.globals) {
  globals[global.slug] = await payload.findGlobal({
    slug: global.slug,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`  global ${global.slug}: ok`)
}

// Uploads and credentials bypass the field layer. Media rows carry filenames and every
// generated size variant, and Payload has no way to accept an existing password hash.
const sqlite = new Database((process.env.DATABASE_URL || '').replace(/^file:/, ''), {
  readonly: true,
})
const mediaRows = sqlite.prepare('SELECT * FROM media ORDER BY id').all()
const credentials = sqlite
  .prepare("SELECT id, hash, salt FROM users WHERE hash IS NOT NULL AND hash != ''")
  .all()
sqlite.close()

await fs.mkdir(OUT_DIR, { recursive: true })
const outFile = path.join(OUT_DIR, 'export.json')
await fs.writeFile(outFile, JSON.stringify({ collections, credentials, globals, mediaRows }, null, 2))

console.log(`\n  media rows: ${mediaRows.length}`)
console.log(`  credential rows: ${credentials.length}`)
console.log(`\nwrote ${outFile}`)

process.exit(0)
