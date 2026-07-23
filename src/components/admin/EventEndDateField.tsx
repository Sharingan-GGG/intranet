'use client'

import type { DateFieldClientProps } from 'payload'

import { DateTimeField, useFormFields } from '@payloadcms/ui'
import React, { useMemo } from 'react'

/**
 * End-date picker for Events that greys out any day before the chosen start date.
 * Wraps Payload's built-in DateTimeField and injects a dynamic `minDate` (the
 * sibling `date` value), so earlier dates can't be selected in the calendar.
 */
export const EventEndDateField: React.FC<DateFieldClientProps> = (props) => {
  const startDate = useFormFields(([fields]) => fields?.date?.value as string | undefined)

  const field = useMemo(() => {
    if (!startDate) return props.field
    const start = new Date(startDate)
    if (Number.isNaN(start.getTime())) return props.field
    const admin = (props.field.admin ?? {}) as Record<string, unknown>
    const date = (admin.date ?? {}) as Record<string, unknown>
    return {
      ...props.field,
      admin: { ...admin, date: { ...date, minDate: start } },
    } as typeof props.field
  }, [props.field, startDate])

  return <DateTimeField {...props} field={field} />
}
