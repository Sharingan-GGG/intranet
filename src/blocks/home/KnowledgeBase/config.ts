import type { Block } from 'payload'

export const KnowledgeBase: Block = {
  slug: 'knowledgeBase',
  interfaceName: 'KnowledgeBaseBlock',
  labels: { singular: 'Knowledge Base', plural: 'Knowledge Bases' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { placeholder: 'Knowledge base' },
    },
  ],
}
