import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf } from '../../access/isAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: isAdmin,
    delete: isAdmin,
    read: authenticated,
    update: isAdminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['user'],
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'User', value: 'user' },
      ],
      // Store roles in the JWT so access checks don't need a DB lookup
      saveToJWT: true,
      access: {
        // Only admins can grant or change roles
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      admin: {
        description: 'The department this user belongs to.',
      },
    },
    {
      name: 'assignedRoles',
      type: 'relationship',
      relationTo: 'roles',
      hasMany: true,
      access: {
        // Only admins can assign business roles
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        description: 'Business roles (from the Roles collection) assigned to this user.',
      },
    },
  ],
  timestamps: true,
}
