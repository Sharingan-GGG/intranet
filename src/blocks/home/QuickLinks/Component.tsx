import React from 'react'

import type { QuickLinksBlock as Props } from '@/payload-types'

import { getQuickLinks } from '@/lib/homeData'
import { QuickLinks } from '@/components/home/QuickLinks'

export const QuickLinksBlockComponent: React.FC<Props> = async ({ heading }) => {
  const links = await getQuickLinks()
  return <QuickLinks links={links} heading={heading ?? undefined} />
}
