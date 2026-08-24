import React from 'react'

import type { FeedbackBlock as Props } from '@/payload-types'

import { Feedback } from '@/components/home/Feedback'

export const FeedbackBlockComponent: React.FC<Props> = ({ cards }) => <Feedback cards={cards} />
