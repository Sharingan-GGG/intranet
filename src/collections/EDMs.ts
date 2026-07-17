import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const EDMs: CollectionConfig = {
  slug: 'edms',
  labels: {
    singular: 'EDM',
    plural: 'EDMs',
  },
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'updatedAt'],
    group: 'Intranet',
    description: 'Marketing EDMs shown in the "Latest EDMs" section on the home page.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      // Only sub-categories that sit under the parent "EDMs" category.
      filterOptions: () => ({
        'parent.slug': { equals: 'edms' },
      }),
      admin: {
        description: 'A sub-category of the EDMs parent category.',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'URL',
      admin: {
        description: 'Link to the hosted EDM.',
      },
    },
  ],
  timestamps: true,
}
