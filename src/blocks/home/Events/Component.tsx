import React from 'react'

import type { EventsBlock as Props } from '@/payload-types'

import { getEventGroups } from '@/lib/homeData'
import { Events } from '@/components/home/Events'

export const EventsBlockComponent: React.FC<Props> = async ({ heading }) => {
  const groups = await getEventGroups()
  return <Events groups={groups} heading={heading ?? undefined} />
}
