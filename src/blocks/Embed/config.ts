import type { Block } from 'payload'

export const Embed: Block = {
  slug: 'embed',
  interfaceName: 'EmbedBlock',
  fields: [
    {
      name: 'url',
      type: 'text',
      label: 'Embed URL',
      required: true,
      admin: {
        description: 'The URL to embed, e.g. a YouTube, Google Maps, or Figma embed link.',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'URL is required'
        try {
          const parsed = new URL(value)
          if (parsed.protocol !== 'https:') {
            return 'URL must use https://'
          }
        } catch {
          return 'Please enter a valid URL'
        }
        return true
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      admin: {
        description: 'A short description of the embedded content, for accessibility.',
      },
    },
    {
      name: 'aspectRatio',
      type: 'select',
      defaultValue: '16/9',
      options: [
        { label: '16:9', value: '16/9' },
        { label: '4:3', value: '4/3' },
        { label: '1:1', value: '1/1' },
      ],
    },
  ],
}
