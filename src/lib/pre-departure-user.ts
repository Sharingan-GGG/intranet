import 'server-only'

import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'

import type { UserRole } from '@/lib/supabase/database.types'

/**
 * Payload roles mapped onto the Pre-Departure permission model.
 *
 * `editor` has no equivalent — role_permissions only knows admin and user — so it gets the
 * baseline rather than silently inheriting admin's destructive rights (delete_pnr,
 * delete_note). Order matters below: the highest privilege a user holds wins.
 */
const ROLE_PRECEDENCE = ['super-admin', 'admin', 'editor', 'user'] as const

const ROLE_MAP: Record<string, UserRole> = {
  'super-admin': 'super_admin',
  admin: 'admin',
  editor: 'user',
  user: 'user',
}

export type PreDepartureUser = {
  departmentId: null | string
  email: string
  full_name: null | string
  id: string
  role: UserRole
}

/**
 * The signed-in Payload user, shaped like the `profiles` row this module used to read.
 *
 * Replaces `supabase.auth.getUser()` followed by a profiles lookup: Payload's Supabase auth
 * strategy already resolves the session, so identity comes from one place. Returns null when
 * there is no session, which callers turn into a 401.
 */
export async function getPreDepartureUser(): Promise<null | PreDepartureUser> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return null

  const roles = Array.isArray(user.roles) ? (user.roles as string[]) : []
  const highest = ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? 'user'

  const department = user.department as null | string | { id: string } | undefined
  const departmentId =
    typeof department === 'string' ? department : (department?.id ?? null)

  return {
    departmentId,
    email: user.email,
    full_name: user.name ?? null,
    id: String(user.id),
    role: ROLE_MAP[highest] ?? 'user',
  }
}
