import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { hasAdminCollectionAccess } from '../access/departmentPermissions'

const timezoneOptions = Intl.supportedValuesOf('timeZone').map((tz) => ({
  label: tz.replace(/_/g, ' '),
  value: tz,
}))

export const TimeZones: CollectionConfig = {
  slug: 'time-zones',
  lockDocuments: { duration: 30 },
  access: {
    read: authenticated,
    create: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'time-zones'),
    update: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'time-zones'),
    delete: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'time-zones'),
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
