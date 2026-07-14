import type { Access, AccessArgs, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

export const isAdmin: Access = ({ req: { user } }: AccessArgs<User>) => {
  return Boolean(user?.roles?.includes('admin'))
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return Boolean(user?.roles?.includes('admin'))
}

export const isAdminOrEditor: Access = ({ req: { user } }: AccessArgs<User>) => {
  return Boolean(user?.roles?.some((r) => r === 'admin' || r === 'editor'))
}

export const isAdminOrSelf: Access = ({ req: { user } }: AccessArgs<User>) => {
  if (!user) return false
  if (user.roles?.includes('admin')) return true

  return {
    id: {
      equals: user.id,
    },
  }
}
