import type { Block } from 'payload'

export const EventsBlock: Block = {
  slug: 'eventsBlock',
  interfaceName: 'EventsBlock',
  labels: { singular: 'Upcoming Events', plural: 'Upcoming Events' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { placeholder: 'Upcoming events' },
    },
  ],
}
