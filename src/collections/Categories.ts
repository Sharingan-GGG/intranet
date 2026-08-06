import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { hasAdminCollectionAccess } from '../access/departmentPermissions'
import { slugField } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'categories'),
    delete: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'categories'),
    read: anyone,
    update: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'categories'),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'parent', 'order'],
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        description: 'Optional parent category, e.g. sub-categories of EDMs.',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 1,
      min: 1,
      admin: {
        description:
          'Display order among categories sharing the same parent (1 comes first). Parent categories default to 1.',
      },
    },
    slugField({
      position: undefined,
    }),
  ],
}
