import type { Block } from 'payload'

export const NewsSlider: Block = {
  slug: 'newsSlider',
  interfaceName: 'NewsSliderBlock',
  labels: { singular: 'News Slider', plural: 'News Sliders' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { placeholder: 'Latest CTG News' },
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 12,
      min: 1,
      admin: { step: 1, description: 'Maximum number of news cards to show.' },
    },
  ],
}
