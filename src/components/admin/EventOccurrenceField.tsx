'use client'

import type { DateFieldClientProps, OptionObject } from 'payload'

import { SelectInput, useField, useFormFields } from '@payloadcms/ui'
import React, { useMemo } from 'react'

import { dayKey, seriesDates } from '@/utilities/eventOccurrences'

const formatDay = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Australia/Adelaide',
})

/**
 * Picker for an exception's `originalDate`: a dropdown of the dates the series
 * actually falls on (today → a year ahead), built from the event's own date and
 * repeat fields, so an exception can't point at a day the event never occurs.
 */
export const EventOccurrenceField: React.FC<DateFieldClientProps> = ({ field, path }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const series = useFormFields(([fields]) => ({
    date: fields?.date?.value as string | undefined,
    repeat: fields?.repeat?.value as string | undefined,
    repeatEvery: fields?.repeatEvery?.value as number | undefined,
    repeatFrequency: fields?.repeatFrequency?.value as string | undefined,
  }))

  const options = useMemo<OptionObject[]>(() => {
    if (!series.date) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizon = new Date()
    horizon.setFullYear(horizon.getFullYear() + 1)
    const dates = seriesDates(series as { date: string }, horizon).filter(
      (d) => new Date(d) >= today,
    )
    // Keep a saved occurrence visible even once it's in the past.
    if (value && !dates.some((d) => dayKey(d) === dayKey(value))) dates.unshift(value)
    return dates.map((d) => ({ label: formatDay.format(new Date(d)), value: d }))
  }, [series.date, series.repeat, series.repeatEvery, series.repeatFrequency, value]) // eslint-disable-line react-hooks/exhaustive-deps

  // The stored ISO may differ from the generated one by time-of-day; match by day.
  const selected = value ? options.find((o) => dayKey(o.value) === dayKey(value))?.value : undefined

  return (
    <div style={{ flex: '1 1 auto', width: field.admin?.width ?? '100%' }}>
      <SelectInput
        path={path}
        name={field.name}
        label={field.label || 'Occurrence'}
        required={field.required}
        description={
          options.length ? field.admin?.description : 'Set the event date and repeat first.'
        }
        options={options}
        value={selected}
        onChange={(option) => {
          const picked = Array.isArray(option) ? option[0] : option
          setValue(picked ? (picked as OptionObject).value : null)
        }}
        showError={showError}
        Error={showError ? errorMessage : undefined}
        isClearable={false}
      />
    </div>
  )
}
