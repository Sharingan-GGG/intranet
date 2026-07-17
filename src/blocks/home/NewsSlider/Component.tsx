import React from 'react'

import type { NewsSliderBlock as Props } from '@/payload-types'

import { getNews } from '@/lib/homeData'
import { NewsSlider } from '@/components/home/NewsSlider'

export const NewsSliderBlockComponent: React.FC<Props> = async ({ heading, limit }) => {
  const items = await getNews()
  return <NewsSlider items={items.slice(0, limit ?? 12)} heading={heading ?? undefined} />
}
