import React from 'react'

import type { KnowledgeBaseBlock as Props } from '@/payload-types'

import { getKbCategories, getKbDocs } from '@/lib/homeData'
import { KnowledgeBase } from '@/components/home/KnowledgeBase'

export const KnowledgeBaseBlockComponent: React.FC<Props> = async ({ heading }) => {
  const [documents, categories] = await Promise.all([getKbDocs(), getKbCategories()])
  return <KnowledgeBase documents={documents} categories={categories} heading={heading ?? undefined} />
}
