import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { hasAdminCollectionAccess } from '../access/departmentPermissions'
import { slugField } from 'payload'
import { makeRevalidateCollectionTags } from '../utilities/revalidateCollectionTag'

export const Categories: CollectionConfig = {
  slug: 'categories',
  lockDocuments: { duration: 30 },
  // Category structure feeds the news/EDM/KB tab lists and news-category filtering,
  // so a category edit must bust those caches too, not just its own.
  hooks: makeRevalidateCollectionTags(
    'collection_categories',
    'collection_posts',
    'collection_edms',
    'collection_knowledge-base',
  ),
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
