import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const Departments: CollectionConfig = {
  slug: 'departments',
  // Collection-level access control
  access: {
    // Any signed-in staff member can browse departments
    read: authenticated,
    // Only admins can manage the org structure
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'lead'],
    group: 'Organization',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'code',
      type: 'text',
      unique: true,
      admin: {
        description: 'Short code, e.g. "ENG", "HR", "SALES".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Department head / manager.',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'departments',
      admin: {
        description: 'Parent department, for nested org structures.',
      },
    },
  ],
  timestamps: true,
}
