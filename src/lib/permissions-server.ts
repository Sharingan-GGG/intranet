import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, UserRole } from "@/lib/supabase/database.types"
import {
  getRolePermissionsFromSQLite,
  setRolePermissions,
} from "@/lib/sqlite/cache"
import type { PermissionMap } from "@/lib/permissions"

export * from "@/lib/permissions"

export async function getRolePermissions(
  supabase: SupabaseClient<Database>,
  role: UserRole
): Promise<PermissionMap | null> {
  if (role === "super_admin") return null

  const cached = getRolePermissionsFromSQLite(role)
  if (cached) {
    return Object.fromEntries(cached.map((r) => [r.action, r.allowed])) as PermissionMap
  }

  const { data } = await supabase
    .from("role_permissions")
    .select("id, action, allowed")
    .eq("role", role)

  if (data) {
    setRolePermissions(
      role,
      data.map((r) => ({ id: r.id, action: r.action, allowed: r.allowed }))
    )
  }

  return Object.fromEntries(
    (data ?? []).map((r) => [r.action, r.allowed])
  ) as PermissionMap
}
