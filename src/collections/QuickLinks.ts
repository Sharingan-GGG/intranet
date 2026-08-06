import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { hasAdminCollectionAccess } from '../access/departmentPermissions'

export const QuickLinks: CollectionConfig = {
  slug: 'quick-links',
  access: {
    read: authenticated,
    create: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'quick-links'),
    update: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'quick-links'),
    delete: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'quick-links'),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'department', 'order'],
    group: 'Intranet',
    description: 'Templates of shortcut buttons shown on the intranet home page, grouped and tagged by department.',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal name for this group of links, e.g. "Sales Tools". Not shown on the site.',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first.',
        position: 'sidebar',
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
      admin: {
        description: 'Restrict this group of links to specific departments. Leave empty to show to everyone.',
        position: 'sidebar',
      },
    },
    {
      name: 'links',
      type: 'array',
      admin: {
        description: 'The buttons in this group, in the order they should appear.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: {
            description: 'Button name, e.g. "Gmail".',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          admin: {
            description: 'Icon shown on the button.',
          },
        },
        {
          name: 'link',
          type: 'text',
          required: true,
          admin: {
            description: 'External URL (https://…) or internal path (/page).',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
