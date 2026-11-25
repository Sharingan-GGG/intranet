// Who is an admin? Pure functions, no I/O. Unit-tested in roles.test.ts.
//
// THE RULE (intranet port)
//   - Each intranet user has Payload roles (users.roles: 'super-admin' | 'admin' | 'editor' | 'user'),
//     carried in the session JWT, so no database lookup is needed.
//   - If ANY of their roles is an admin value → quiz roles ['user', 'admin'] (can see the report).
//   - Everyone else → ['user'] = normal staff.
//   - Fail closed: an unrecognised or missing value NEVER grants admin.
//
// Role names in this app (from types.ts):  'user' = normal staff,  'admin' = can see the report.
// Admins are staff too, so they also get 'user' (they still have to complete the quiz).

import type { Role, User } from './types';

/**
 * Payload role values that may see the completion report. Compared case-insensitively, ignoring
 * spaces at the ends. To override without a code change, set QUIZ_ADMIN_ROLE_VALUES (see below).
 */
export const DEFAULT_ADMIN_ROLE_VALUES = ['super-admin', 'admin'];

/** Lower-case + trim, so 'Admin ', 'admin' and 'ADMIN' all compare equal. */
const normalise = (value: string) => value.trim().toLowerCase();

/**
 * Optional override from an environment variable, e.g.  QUIZ_ADMIN_ROLE_VALUES="super-admin"
 * Comma-separated. Empty or missing → the defaults above.
 */
export function parseAdminRoleValues(envValue: string | undefined): string[] {
  const list = (envValue ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ADMIN_ROLE_VALUES;
}

/**
 * Turns a person's intranet role values into quiz roles.
 *   ['super-admin']   → ['user', 'admin']
 *   ['editor']        → ['user']
 *   []                → ['user']
 */
export function rolesFromIntranetRoles(
  roleValues: readonly (string | null | undefined)[],
  adminRoleValues: readonly string[] = DEFAULT_ADMIN_ROLE_VALUES,
): Role[] {
  const admin = new Set(adminRoleValues.map(normalise));
  const isReportAdmin = roleValues.some((v) => typeof v === 'string' && admin.has(normalise(v)));
  return isReportAdmin ? ['user', 'admin'] : ['user'];
}

/** Only admins can see the completion report and other people's results. */
export function isAdmin(user: Pick<User, 'role'>): boolean {
  return user.role.includes('admin');
}
