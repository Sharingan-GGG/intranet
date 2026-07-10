import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const Roles: CollectionConfig = {
  slug: 'roles',
  // Collection-level access control — roles govern permissions,
  // so only admins may create or change them.
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'department'],
    group: 'Organization',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Business role, e.g. "HR Manager", "Sales Rep".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      admin: {
        description: 'Department this role belongs to (optional).',
      },
    },
    {
      // Capabilities this role grants, drawn from the customizable
      // Permissions collection. Useful for driving UI / feature flags.
      name: 'permissions',
      type: 'relationship',
      relationTo: 'permissions',
      hasMany: true,
    },
  ],
  timestamps: true,
}
