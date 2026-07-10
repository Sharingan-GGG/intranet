import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

const timezoneOptions = Intl.supportedValuesOf('timeZone').map((tz) => ({
  label: tz.replace(/_/g, ' '),
  value: tz,
}))

export const TimeZones: CollectionConfig = {
  slug: 'time-zones',
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'timezone', 'order'],
    group: 'Intranet',
    description: 'Office clocks shown on the intranet home page.',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name, e.g. "Adelaide".',
      },
    },
    {
      name: 'timezone',
      type: 'select',
      required: true,
      options: timezoneOptions,
      admin: {
        description: 'IANA time zone — clocks stay DST-safe.',
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
