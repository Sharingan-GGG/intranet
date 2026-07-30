import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, UserRole } from "@/lib/supabase/database.types"

/**
 * Pre Departure Module - Action Permissions
 *
 * This permission system is specific to the Pre Departure module.
 * Permissions control which actions users can perform in Pre Departure operations.
 *
 * Supported Roles:
 * - super_admin: Full access to all Pre Departure actions (default: all allowed)
 * - admin: Access controlled by role_permissions table
 * - user: Access controlled by role_permissions table
 */

export type PermissionAction =
  | "scan_pnr"
  | "move_pnr"
  | "delete_pnr"
  | "create_note"
  | "delete_note"
  | "create_report_it"

export type PermissionMap = Record<PermissionAction, boolean>

/**
 * Default permissions for Super Admin (Pre Departure Only).
 * Super Admin has access to all Pre Departure actions by default.
 */
export const SUPER_ADMIN_PERMISSIONS: PermissionMap = {
  scan_pnr: true,
  move_pnr: true,
  delete_pnr: true,
  create_note: true,
  delete_note: true,
  create_report_it: true,
}

/**
 * Returns a map of allowed actions for the given role, or null for super_admin (always allowed).
 * NOTE: This permission system is specific to the Pre Departure module.
 *
 * Pass any Supabase client (SSR or service) — the table has open SELECT RLS.
 *
 * @param supabase - Supabase client instance
 * @param role - User role (super_admin, admin, or user)
 * @returns Permission map for admin/user roles, null for super_admin (all allowed)
 */
export async function getRolePermissions(
  supabase: SupabaseClient<Database>,
  role: UserRole
): Promise<PermissionMap | null> {
  // Super Admin always has all permissions in Pre Departure
  if (role === "super_admin") return null

  const { data } = await supabase
    .from("role_permissions")
    .select("action, allowed")
    .eq("role", role)

  return Object.fromEntries(
    (data ?? []).map((r) => [r.action, r.allowed])
  ) as PermissionMap
}

/**
 * Check if an action is allowed for the given permissions.
 * NOTE: Permissions apply only to Pre Departure module actions.
 *
 * @param permissions - Permission map (null = super_admin = always allowed)
 * @param action - Action to check (Pre Departure specific)
 * @returns true if action is allowed, false otherwise
 */
export function isAllowed(
  permissions: PermissionMap | null,
  action: PermissionAction
): boolean {
  // Super Admin (null) always allowed
  if (permissions === null) return true
  return permissions[action] ?? false
}
