import type { Block } from 'payload'

export const Feedback: Block = {
  slug: 'feedback',
  interfaceName: 'FeedbackBlock',
  labels: { singular: 'Feedback', plural: 'Feedbacks' },
  fields: [
    {
      name: 'cards',
      type: 'array',
      label: 'Cards',
      admin: {
        initCollapsed: true,
        components: { RowLabel: '@/blocks/home/Feedback/RowLabel#RowLabel' },
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
        },
        {
          name: 'buttonLabel',
          type: 'text',
          required: true,
        },
        {
          name: 'buttonUrl',
          type: 'text',
          required: true,
          admin: {
            description: 'External URL (https://…) or internal path (/page) the button opens.',
          },
        },
      ],
    },
  ],
}
