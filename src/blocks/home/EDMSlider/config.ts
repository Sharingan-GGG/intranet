import type { Block } from 'payload'

export const EdmSlider: Block = {
  slug: 'edmSlider',
  interfaceName: 'EdmSliderBlock',
  labels: { singular: 'EDM Slider', plural: 'EDM Sliders' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { placeholder: 'Latest EDMs' },
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 12,
      min: 1,
      admin: { step: 1, description: 'Maximum number of EDM cards to show.' },
    },
  ],
}
