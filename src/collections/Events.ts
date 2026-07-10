import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'date', 'location'],
    group: 'Intranet',
    description: 'Upcoming events shown on the intranet home page.',
  },
  defaultSort: 'date',
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
        { label: 'People', value: 'People' },
        { label: 'Training', value: 'Training' },
        { label: 'Company', value: 'Company' },
        { label: 'Social', value: 'Social' },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'd MMM yyyy',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'time',
      type: 'text',
      admin: {
        description: 'e.g. "2:00–3:00 PM" or "All day".',
      },
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'e.g. "Adelaide HQ, Boardroom" or "Online · Teams".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL for the event detail page. Auto-generated from the title if left blank.',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => value || (data?.title ? slugify(data.title) : value),
        ],
      },
    },
  ],
  timestamps: true,
}
