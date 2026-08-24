'use client'
import { FeedbackBlock } from '@/payload-types'
import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

export const RowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<NonNullable<FeedbackBlock['cards']>[number]>()

  const label = data?.data?.title
    ? `Card ${data.rowNumber !== undefined ? data.rowNumber + 1 : ''}: ${data?.data?.title}`
    : 'Card'

  return <div>{label}</div>
}
