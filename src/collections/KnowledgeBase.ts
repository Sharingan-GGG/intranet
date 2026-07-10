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
      type: 'select',
      required: true,
      options: [
        { label: 'Policies', value: 'Policies' },
        { label: 'Finance', value: 'Finance' },
        { label: 'Operations', value: 'Operations' },
        { label: 'Marketing', value: 'Marketing' },
        { label: 'People', value: 'People' },
      ],
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
      name: 'link',
      type: 'text',
      admin: {
        description: 'External URL, used when no file is uploaded.',
        condition: (data) => !data?.file,
      },
    },
  ],
  timestamps: true,
}
