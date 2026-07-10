import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const QuickLinks: CollectionConfig = {
  slug: 'quick-links',
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'link', 'order'],
    group: 'Intranet',
    description: 'Shortcut buttons shown on the intranet home page.',
  },
  defaultSort: 'order',
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
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first.',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
