'use client'

import { useEffect, useState } from 'react'

const timeFmt = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

/**
 * Renders an event start time in the viewer's local timezone.
 * Shows `fallback` (the server-rendered, Adelaide-formatted time) until mounted,
 * then reformats `iso` using the browser's own timezone — same instant, no hydration mismatch.
 */
export const LocalTime: React.FC<{ iso?: string | null; fallback: string }> = ({ iso, fallback }) => {
  const [label, setLabel] = useState(fallback)

  useEffect(() => {
    if (!iso) return
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) return
    setLabel(timeFmt.format(parsed))
  }, [iso])

  return <>{label}</>
}
