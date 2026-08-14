import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { hasAdminCollectionAccess } from '../access/departmentPermissions'
import { makeRevalidateCollectionTags } from '../utilities/revalidateCollectionTag'

export const EDMs: CollectionConfig = {
  slug: 'edms',
  lockDocuments: { duration: 30 },
  hooks: makeRevalidateCollectionTags('collection_edms'),
  labels: {
    singular: 'EDM',
    plural: 'EDMs',
  },
  access: {
    read: authenticated,
    create: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'edms'),
    update: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'edms'),
    delete: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'edms'),
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
      name: 'dateSent',
      type: 'date',
      label: 'Date sent',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'd MMM yyyy',
        },
        description: 'The day the EDM was sent. Falls back to the created date when blank.',
      },
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
