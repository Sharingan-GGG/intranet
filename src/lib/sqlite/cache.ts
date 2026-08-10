import { getSQLiteDb } from "./db"

// ----- brands -----

export function getBrandByCode(code: string): number | null {
  const db = getSQLiteDb()
  if (!db) return null
  const row = db.prepare("SELECT id FROM brands WHERE code = ?").get(code) as { id: number } | undefined
  return row?.id ?? null
}

export function setBrand(id: number, code: string) {
  const db = getSQLiteDb()
  if (!db) return
  db.prepare("INSERT OR REPLACE INTO brands (id, code) VALUES (?, ?)").run(id, code)
}

// ----- role_permissions -----

export function getRolePermissionsFromSQLite(
  role: string
): Array<{ action: string; allowed: boolean }> | null {
  const db = getSQLiteDb()
  if (!db) return null
  const cached = db
    .prepare("SELECT 1 FROM cache_meta WHERE tbl = 'role_permissions' AND key = ?")
    .get(role)
  if (!cached) return null

  const rows = db
    .prepare("SELECT action, allowed FROM role_permissions WHERE role = ?")
    .all(role) as Array<{ action: string; allowed: number }>
  return rows.map((r) => ({ action: r.action, allowed: r.allowed === 1 }))
}

export function setRolePermissions(
  role: string,
  rows: Array<{ id: string; action: string; allowed: boolean }>
) {
  const db = getSQLiteDb()
  if (!db) return
  const insertPerm = db.prepare(
    "INSERT OR REPLACE INTO role_permissions (id, role, action, allowed) VALUES (?, ?, ?, ?)"
  )
  const insertMeta = db.prepare(
    "INSERT OR REPLACE INTO cache_meta (tbl, key) VALUES ('role_permissions', ?)"
  )
  db.transaction(() => {
    db.prepare("DELETE FROM role_permissions WHERE role = ?").run(role)
    for (const r of rows) insertPerm.run(r.id, role, r.action, r.allowed ? 1 : 0)
    insertMeta.run(role)
  })()
}

export function invalidateRolePermissions() {
  const db = getSQLiteDb()
  if (!db) return
  db.prepare("DELETE FROM role_permissions").run()
  db.prepare("DELETE FROM cache_meta WHERE tbl = 'role_permissions'").run()
}

// ----- department_page_access -----

export function getDepartmentPageAccessFromSQLite(departmentId: string): string[] | null {
  const db = getSQLiteDb()
  if (!db) return null
  const cached = db
    .prepare("SELECT 1 FROM cache_meta WHERE tbl = 'department_page_access' AND key = ?")
    .get(departmentId)
  if (!cached) return null

  const rows = db
    .prepare("SELECT page_id FROM department_page_access WHERE department_id = ?")
    .all(departmentId) as Array<{ page_id: string }>
  return rows.map((r) => r.page_id)
}

export function setDepartmentPageAccess(departmentId: string, pageIds: string[]) {
  const db = getSQLiteDb()
  if (!db) return
  const insertAccess = db.prepare(
    "INSERT OR REPLACE INTO department_page_access (department_id, page_id) VALUES (?, ?)"
  )
  const insertMeta = db.prepare(
    "INSERT OR REPLACE INTO cache_meta (tbl, key) VALUES ('department_page_access', ?)"
  )
  db.transaction(() => {
    db.prepare("DELETE FROM department_page_access WHERE department_id = ?").run(departmentId)
    for (const pageId of pageIds) insertAccess.run(departmentId, pageId)
    insertMeta.run(departmentId)
  })()
}

export function invalidateDepartmentPageAccess(departmentId?: string) {
  const db = getSQLiteDb()
  if (!db) return
  if (departmentId) {
    db.prepare("DELETE FROM department_page_access WHERE department_id = ?").run(departmentId)
    db
      .prepare("DELETE FROM cache_meta WHERE tbl = 'department_page_access' AND key = ?")
      .run(departmentId)
  } else {
    db.prepare("DELETE FROM department_page_access").run()
    db.prepare("DELETE FROM cache_meta WHERE tbl = 'department_page_access'").run()
  }
}
