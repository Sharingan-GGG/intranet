import type { Block } from 'payload'

export const FeaturedSpotlight: Block = {
  slug: 'featuredSpotlight',
  interfaceName: 'FeaturedSpotlightBlock',
  labels: { singular: 'Featured Spotlight', plural: 'Featured Spotlights' },
  fields: [
    {
      name: 'limit',
      type: 'number',
      defaultValue: 3,
      min: 1,
      admin: { step: 1, description: 'Maximum number of featured news items to show.' },
    },
  ],
}
