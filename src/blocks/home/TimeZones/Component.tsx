import React from 'react'

import { getOffices } from '@/lib/homeData'
import { TimeZones } from '@/components/home/TimeZones'

export const TimeZonesBlockComponent: React.FC = async () => {
  const offices = await getOffices()
  return <TimeZones offices={offices} />
}
