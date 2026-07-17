import type { Block } from 'payload'

export const QuickLinks: Block = {
  slug: 'quickLinks',
  interfaceName: 'QuickLinksBlock',
  labels: { singular: 'Quick Links', plural: 'Quick Links' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { placeholder: 'Quickest links' },
    },
  ],
}
