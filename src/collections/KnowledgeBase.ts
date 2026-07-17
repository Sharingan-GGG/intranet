import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const KnowledgeBase: CollectionConfig = {
  slug: 'knowledge-base',
  labels: {
    singular: 'Knowledge Base Document',
    plural: 'Knowledge Base',
  },
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'fileType', 'updatedAt'],
    group: 'Intranet',
    description: 'Documents shown in the knowledge base on the intranet home page.',
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
      // Only sub-categories that sit under the parent "Knowledge Base" category.
      filterOptions: () => ({
        'parent.slug': { equals: 'knowledge-base' },
      }),
      admin: {
        description: 'A sub-category of the Knowledge Base parent category.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Short summary — also matched by the intranet search.',
      },
    },
    {
      name: 'fileType',
      type: 'select',
      required: true,
      defaultValue: 'PDF',
      options: [
        { label: 'PDF', value: 'PDF' },
        { label: 'XLS', value: 'XLS' },
        { label: 'DOC', value: 'DOC' },
        { label: 'Folder', value: 'Folder' },
      ],
      admin: {
        description: 'Drives the file-type badge in the list.',
      },
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Upload the document, or leave empty and set an external link below.',
      },
    },
    {
      name: 'links',
      type: 'array',
      labels: {
        singular: 'Link',
        plural: 'Links',
      },
      admin: {
        description:
          'External URLs, used when no file is uploaded. With multiple links, the intranet shows a pop-up listing them.',
        condition: (data) => !data?.file,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: {
            description: 'Shown in the pop-up. Falls back to the URL if left blank.',
          },
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'URL',
        },
      ],
    },
  ],
  timestamps: true,
}
