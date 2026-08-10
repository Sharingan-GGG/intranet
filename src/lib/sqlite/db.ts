import "server-only"

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"

const DB_DIR = path.join(process.cwd(), ".sqlite")
const DB_PATH = path.join(DB_DIR, "cache.db")

function createDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma("journal_mode = WAL")
  db.pragma("synchronous = NORMAL")

  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id   INTEGER PRIMARY KEY,
      code TEXT    UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      id      TEXT    PRIMARY KEY,
      role    TEXT    NOT NULL,
      action  TEXT    NOT NULL,
      allowed INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS department_page_access (
      department_id TEXT NOT NULL,
      page_id       TEXT NOT NULL,
      PRIMARY KEY (department_id, page_id)
    );
    CREATE TABLE IF NOT EXISTS cache_meta (
      tbl TEXT NOT NULL,
      key TEXT NOT NULL,
      PRIMARY KEY (tbl, key)
    );
  `)

  return db
}

let _db: Database.Database | null = null
// Distinct from `_db === null` (not yet opened) — set once opening has failed, so a broken
// native binding (e.g. no better-sqlite3 build for the host's glibc) is only logged once
// and every caller falls back to Postgres instead of crashing the request.
let _unavailable = false

/** Null when the local cache can't be opened — callers must treat that as a permanent miss. */
export function getSQLiteDb(): Database.Database | null {
  if (_unavailable) return null
  if (!_db) {
    try {
      _db = createDb()
    } catch (e) {
      _unavailable = true
      console.error("SQLite cache unavailable, falling back to Postgres for every lookup:", e)
      return null
    }
  }
  return _db
}
