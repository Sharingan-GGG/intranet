import type { Access, AccessArgs, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

// Super Admin is a superset of Admin — it satisfies every admin-level check
// below AND unlocks super-admin-only areas (e.g. Globals). So a user whose
// only role is 'super-admin' still has full edit permission everywhere.
const hasRole = (user: User | null | undefined, ...roles: string[]) =>
  Boolean(user?.roles?.some((r) => roles.includes(r)))

export const isSuperAdmin: Access = ({ req: { user } }: AccessArgs<User>) => {
  return hasRole(user, 'super-admin')
}

export const isAdmin: Access = ({ req: { user } }: AccessArgs<User>) => {
  return hasRole(user, 'super-admin', 'admin')
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRole(user, 'super-admin', 'admin')
}

export const isAdminOrEditor: Access = ({ req: { user } }: AccessArgs<User>) => {
  return hasRole(user, 'super-admin', 'admin', 'editor')
}

export const isAdminOrSelf: Access = ({ req: { user } }: AccessArgs<User>) => {
  if (!user) return false
  if (hasRole(user, 'super-admin', 'admin')) return true

  return {
    id: {
      equals: user.id,
    },
  }
}
