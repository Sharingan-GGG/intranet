import React from 'react'

import type { NewsCard } from '@/lib/home'
import { CardSlider } from './CardSlider'
import { NewsCardItem } from './NewsCardItem'

export const NewsSlider: React.FC<{ items: NewsCard[]; heading?: string }> = ({
  items,
  heading = 'Latest CTG News',
}) => (
  <CardSlider id="news" title={heading} step={680}>
    {items.map((n, i) => (
      <NewsCardItem key={i} card={n} />
    ))}
  </CardSlider>
)
