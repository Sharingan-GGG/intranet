import React from 'react'

import type { FeedbackBlock as Props } from '@/payload-types'

import { Feedback } from '@/components/home/Feedback'

export const FeedbackBlockComponent: React.FC<Props> = ({ orgChart, feedbackForm }) => (
  <Feedback orgChart={orgChart} feedbackForm={feedbackForm} />
)
