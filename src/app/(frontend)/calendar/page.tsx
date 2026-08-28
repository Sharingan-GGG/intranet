import type { Metadata } from 'next'
import React, { Suspense } from 'react'

import { getCalendarEvents } from '@/lib/homeData'
import { CalendarView } from '@/components/calendar/CalendarView'

// Events are collection-wide (no per-user data) and cached in getCalendarEvents
// via unstable_cache; no need to force a fresh render on every request.
export const revalidate = 300

export default async function CalendarPage() {
  const events = await getCalendarEvents()

  return (
    <div className="il-root il-page">
      <main className="il-main" style={{ maxWidth: 'none' }}>
        <Suspense fallback={null}>
          <CalendarView events={events} />
        </Suspense>
      </main>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'CTG Intranet — Calendar',
  description: 'All upcoming CTG events in a full-page calendar view.',
}
