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
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      // Only sub-categories that sit under the parent "Events" category.
      filterOptions: () => ({
        'parent.slug': { equals: 'events' },
      }),
      admin: {
        description: 'A sub-category of the Events parent category.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
          label: 'Event date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
              displayFormat: 'd MMM yyyy',
            },
            width: '50%',
            description: 'The day the event takes place.',
          },
        },
        {
          name: 'time',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'timeOnly',
              displayFormat: 'h:mm a',
              timeIntervals: 15,
            },
            width: '50%',
            description: 'Start time. Leave blank for all-day events.',
          },
        },
      ],
    },
    {
      name: 'repeat',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Does not repeat', value: 'none' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Fortnightly', value: 'fortnightly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Every 3 months', value: 'quarterly' },
        { label: 'Bi-annually', value: 'biannually' },
        { label: 'Annually', value: 'annually' },
        { label: 'Custom', value: 'custom' },
      ],
      admin: {
        description: 'How often this event repeats.',
      },
    },
    {
      type: 'row',
      admin: {
        condition: (data) => data?.repeat === 'custom',
      },
      fields: [
        {
          name: 'repeatEvery',
          type: 'number',
          label: 'Repeat every',
          min: 1,
          defaultValue: 1,
          admin: {
            width: '50%',
            description: 'e.g. 2 = every 2 weeks/months…',
          },
        },
        {
          name: 'repeatFrequency',
          type: 'select',
          label: 'Frequency',
          defaultValue: 'weeks',
          options: [
            { label: 'Days', value: 'days' },
            { label: 'Weeks', value: 'weeks' },
            { label: 'Months', value: 'months' },
            { label: 'Years', value: 'years' },
          ],
          admin: {
            width: '50%',
          },
        },
      ],
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
