import React from 'react'

import type { EdmSliderBlock as Props } from '@/payload-types'

import { getEdmCategories, getEdms } from '@/lib/homeData'
import { EDMSlider } from '@/components/home/EDMSlider'

export const EdmSliderBlockComponent: React.FC<Props> = async ({ heading, limit }) => {
  const [items, categories] = await Promise.all([getEdms(), getEdmCategories()])
  return <EDMSlider items={items.slice(0, limit ?? 12)} categories={categories} heading={heading ?? undefined} />
}
