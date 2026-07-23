import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { isSuperAdmin } from '@/access/isAdmin'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  // Only Super Admins can view/edit this global in the admin. The frontend
  // reads it via the Local API (overrideAccess), so the public footer is unaffected.
  access: {
    read: isSuperAdmin,
    update: isSuperAdmin,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
