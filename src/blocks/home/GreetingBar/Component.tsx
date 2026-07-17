import React from 'react'

import { GreetingBar } from '@/components/home/GreetingBar'

export const GreetingBarBlockComponent: React.FC<{ userName?: string }> = ({ userName }) => (
  <GreetingBar userName={userName} />
)
