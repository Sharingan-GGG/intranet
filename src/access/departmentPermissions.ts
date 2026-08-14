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
  /** Subset of `pages` granted by a rule that names this user's department specifically. */
  deptPages: Set<string>
  /** Subset of `excludedPages` excluded by a rule that names this user's department specifically. */
  deptExcludedPages: Set<string>
  /** Subset of `pages` granted by a rule that names this user specifically. */
  userPages: Set<string>
  /** Subset of `excludedPages` excluded by a rule that names this user specifically. */
  userExcludedPages: Set<string>
}

/**
 * Loads Permission docs matching the user's role tier and (department or user)
 * (a Permission with no department/users applies globally), and unions their
 * adminCollections/pages/excludedPages into resolved sets.
 *
 * A rule with `users` set matches ONLY those users — its `department` (if any) is just
 * metadata for narrowing the admin picker, not an independent department-wide grant.
 * Otherwise "override for two specific people" would silently grant their whole department too.
 *
 * Pages/excludedPages are tracked three times — unioned across every matching rule, restricted to
 * rules that name this user's department specifically, and restricted to rules that name this
 * user specifically. hasPageAccess needs the split so a user-scoped rule can override a
 * department-scoped one, which can in turn override a department-less default.
 */
export async function resolveUserPermissions(
  payload: Payload,
  user: User | null | undefined,
): Promise<ResolvedAccess> {
  const empty: ResolvedAccess = {
    adminCollections: new Set(),
    deptExcludedPages: new Set(),
    deptPages: new Set(),
    excludedPages: new Set(),
    pages: new Set(),
    userExcludedPages: new Set(),
    userPages: new Set(),
  }
  const tier = getRoleTier(user)
  if (!tier) return empty

  const deptId = typeof user?.department === 'object' ? user?.department?.id : user?.department
  const userId = user?.id

  const { docs } = await payload.find({
    collection: 'permissions',
    overrideAccess: true,
    depth: 0,
    pagination: false,
    where: {
      role: { contains: tier },
      or: [
        { department: { exists: false }, users: { exists: false } },
        // A rule with `users` set applies ONLY to those users — department on the
        // same rule is just context for narrowing the admin picker, not an
        // additional department-wide grant. Otherwise everyone in the department(s)
        // would get in too, defeating the "override for specific people" purpose.
        ...(deptId ? [{ department: { contains: deptId }, users: { exists: false } }] : []),
        ...(userId ? [{ users: { contains: userId } }] : []),
      ],
    },
  })

  const adminCollections = new Set<string>()
  const pages = new Set<string>()
  const excludedPages = new Set<string>()
  const deptPages = new Set<string>()
  const deptExcludedPages = new Set<string>()
  const userPages = new Set<string>()
  const userExcludedPages = new Set<string>()
  for (const doc of docs) {
    const userScoped = (doc.users ?? []).length > 0
    // A `users`-scoped rule is only ever returned via the users match above (never via
    // department), so its department field is descriptive, not a separate grant — don't
    // double-count it as dept-scoped too.
    const deptScoped = !userScoped && (doc.department ?? []).length > 0
    ;(doc.adminCollections ?? []).forEach((c) => adminCollections.add(c))
    ;(doc.pages ?? []).forEach((p) => {
      pages.add(p)
      if (deptScoped) deptPages.add(p)
      if (userScoped) userPages.add(p)
    })
    ;(doc.excludedPages ?? []).forEach((p) => {
      excludedPages.add(p)
      if (deptScoped) deptExcludedPages.add(p)
      if (userScoped) userExcludedPages.add(p)
    })
  }
  return {
    adminCollections,
    deptExcludedPages,
    deptPages,
    excludedPages,
    pages,
    userExcludedPages,
    userPages,
  }
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
 *
 * Precedence, most specific wins: a user-scoped exclude beats a user-scoped grant, which beats
 * a department-scoped exclude, which beats a department-scoped grant, which beats a
 * department-less (global) exclude, which beats the super-admin/admin bypass, which beats a
 * department-less grant. Without this ordering, a global "exclude X by default" rule would
 * permanently defeat the department/user rule meant to grant X back — "all pages except X, but
 * this department/user still gets X" couldn't be expressed otherwise.
 */
export async function hasPageAccess(
  payload: Payload,
  user: User | null | undefined,
  pageKey: string,
): Promise<boolean> {
  const tier = getRoleTier(user)
  if (!tier) return false

  const {
    deptExcludedPages,
    deptPages,
    excludedPages,
    pages,
    userExcludedPages,
    userPages,
  } = await resolveUserPermissions(payload, user)
  if (grants(userExcludedPages, pageKey)) return false
  if (grants(userPages, pageKey)) return true
  if (grants(deptExcludedPages, pageKey)) return false
  if (grants(deptPages, pageKey)) return true
  if (grants(excludedPages, pageKey)) return false
  if (tier === 'super-admin' || tier === 'admin') return true
  return grants(pages, pageKey)
}
