import React from 'react'

import type { FeaturedSpotlightBlock as Props } from '@/payload-types'

import { getFeaturedNews } from '@/lib/homeData'
import { FeaturedSpotlight } from '@/components/home/FeaturedSpotlight'

export const FeaturedSpotlightBlockComponent: React.FC<Props> = async ({ limit }) => {
  const items = await getFeaturedNews()
  return <FeaturedSpotlight items={items.slice(0, limit ?? 3)} />
}
