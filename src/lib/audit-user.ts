import 'server-only'

import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { hasPageAccess } from '@/access/departmentPermissions'

export type AuditUser = {
  departmentId: null | string
  departmentName: null | string
  email: string
  id: string
  name: null | string
}

export type AuditSession = {
  /** Null when nobody is signed in — callers redirect to /login. */
  user: AuditUser | null
  /** False when signed in but not granted `route:audit`. */
  canAccess: boolean
}

/**
 * Who is signed in, and may they open the Audit Hub.
 *
 * The standalone portal this replaces had no authentication of any kind —
 * anyone who could reach the URL had full read/write over every table. Identity
 * here comes from the same place as everywhere else in the intranet: Payload's
 * Supabase auth strategy has already resolved the session by the time this runs.
 *
 * Identity and access resolve together in one call because every page needs
 * both, and splitting them means two `payload.auth()` round-trips per render.
 *
 * Access itself reuses the same `hasPageAccess` check that decides whether the
 * homepage shows someone a link, so the nav and the page can never disagree. It
 * is default-deny: a global Permission rule excludes `route:audit` for everyone
 * and specific departments are granted it back, which also means a user with no
 * department cannot match a department-scoped grant.
 */
export async function getAuditSession(): Promise<AuditSession> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return { user: null, canAccess: false }

  const department = user.department as null | string | { id: string; name?: string } | undefined
  const departmentId = typeof department === 'string' ? department : (department?.id ?? null)
  const departmentName = typeof department === 'string' ? null : (department?.name ?? null)

  return {
    user: {
      departmentId,
      departmentName,
      email: user.email,
      id: String(user.id),
      name: user.name ?? null,
    },
    canAccess: await hasPageAccess(payload, user, 'route:audit'),
  }
}
