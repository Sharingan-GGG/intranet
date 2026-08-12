import type { Block } from 'payload'

export const Feedback: Block = {
  slug: 'feedback',
  interfaceName: 'FeedbackBlock',
  labels: { singular: 'Feedback', plural: 'Feedbacks' },
  fields: [
    {
      name: 'orgChart',
      type: 'group',
      label: 'CTG Organisational Chart card',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'CTG Organisational Chart',
        },
        {
          name: 'description',
          type: 'text',
          defaultValue: 'See how the Complex Travel Group teams fit together.',
        },
        {
          name: 'buttonLabel',
          type: 'text',
          required: true,
          defaultValue: 'View',
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
    {
      name: 'feedbackForm',
      type: 'group',
      label: 'Provide Feedback card',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'Provide Feedback',
        },
        {
          name: 'description',
          type: 'text',
          defaultValue:
            'Submit your feedback or ideas for improvement across the organisation. Not limited to Intranet only - think big or think small. We want to hear it.',
        },
        {
          name: 'buttonLabel',
          type: 'text',
          required: true,
          defaultValue: 'Send',
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
