import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const Permissions: CollectionConfig = {
  slug: 'permissions',
  // Collection-level access — permissions define what roles can do,
  // so only admins may manage them; all staff can read.
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'key', 'collections', 'category'],
    group: 'Organization',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable label, e.g. "View Reports".',
      },
    },
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Machine key used in code, e.g. "reports:view". Must be unique.',
      },
    },
    {
      name: 'collections',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['all'],
      admin: {
        description: 'Which collections this permission grants access to. Use "All" for every collection.',
      },
      options: [
        { label: 'All', value: 'all' },
        { label: 'Pages', value: 'pages' },
        { label: 'Posts', value: 'posts' },
        { label: 'Media', value: 'media' },
        { label: 'Categories', value: 'categories' },
        { label: 'Departments', value: 'departments' },
        { label: 'Roles', value: 'roles' },
        { label: 'Permissions', value: 'permissions' },
        { label: 'Users', value: 'users' },
      ],
    },
    {
      name: 'category',
      type: 'text',
      admin: {
        description: 'Optional grouping, e.g. "Reports", "Content", "Users".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
