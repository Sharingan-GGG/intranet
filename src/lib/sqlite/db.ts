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

export function getSQLiteDb(): Database.Database {
  if (!_db) _db = createDb()
  return _db
}
