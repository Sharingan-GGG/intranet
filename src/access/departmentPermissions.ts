import type { Payload } from 'payload'

import type { User } from '@/payload-types'

export type RoleTier = 'super-admin' | 'admin' | 'editor' | 'user'

/** Highest role tier held by the user (roles is hasMany). */
export function getRoleTier(user: User | null | undefined): RoleTier | null {
  if (!user?.roles?.length) return null
  if (user.roles.includes('super-admin')) return 'super-admin'
  if (user.roles.includes('admin')) return 'admin'
  if (user.roles.includes('editor')) return 'editor'
  if (user.roles.includes('user')) return 'user'
  return null
}

export interface ResolvedAccess {
  adminCollections: Set<string>
  pages: Set<string>
  excludedPages: Set<string>
}

/**
 * Loads Permission docs matching the user's role tier and department
 * (a Permission with no department applies globally), and unions their
 * adminCollections/pages/excludedPages into resolved sets.
 */
export async function resolveUserPermissions(
  payload: Payload,
  user: User | null | undefined,
): Promise<ResolvedAccess> {
  const empty: ResolvedAccess = { adminCollections: new Set(), pages: new Set(), excludedPages: new Set() }
  const tier = getRoleTier(user)
  if (!tier) return empty

  const deptId = typeof user?.department === 'object' ? user?.department?.id : user?.department

  const { docs } = await payload.find({
    collection: 'permissions',
    overrideAccess: true,
    depth: 0,
    pagination: false,
    where: {
      role: { contains: tier },
      or: [{ department: { exists: false } }, ...(deptId ? [{ department: { contains: deptId } }] : [])],
    },
  })

  const adminCollections = new Set<string>()
  const pages = new Set<string>()
  const excludedPages = new Set<string>()
  for (const doc of docs) {
    ;(doc.adminCollections ?? []).forEach((c) => adminCollections.add(c))
    ;(doc.pages ?? []).forEach((p) => pages.add(p))
    ;(doc.excludedPages ?? []).forEach((p) => excludedPages.add(p))
  }
  return { adminCollections, pages, excludedPages }
}

/** True if the resolved set grants `key`, honoring the 'all' sentinel. */
export function grants(set: Set<string>, key: string): boolean {
  return set.has('all') || set.has(key)
}

/**
 * Access check for admin-panel collections: super-admin/admin bypass
 * everything. Editor and user are department-scoped — they need an explicit
 * Permission granting this collection for their role/department.
 */
export async function hasAdminCollectionAccess(
  payload: Payload,
  user: User | null | undefined,
  collectionSlug: string,
): Promise<boolean> {
  const tier = getRoleTier(user)
  if (tier === 'super-admin' || tier === 'admin') return true
  if (!user) return false
  const { adminCollections } = await resolveUserPermissions(payload, user)
  return grants(adminCollections, collectionSlug)
}

/**
 * Front-end helper: does this user see this homepage block / route?
 * An explicit excludedPages entry always wins, even over "All" or the
 * super-admin/admin bypass — that's the point of "all pages except X".
 */
export async function hasPageAccess(
  payload: Payload,
  user: User | null | undefined,
  pageKey: string,
): Promise<boolean> {
  const tier = getRoleTier(user)
  if (!tier) return false

  const { pages, excludedPages } = await resolveUserPermissions(payload, user)
  if (grants(excludedPages, pageKey)) return false
  if (tier === 'super-admin' || tier === 'admin') return true
  return grants(pages, pageKey)
}
