'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { getContentAuditStatuses } from '@/app/audit/actions'

/** The worker runs out of band, so stop waiting after an hour either way. */
const MAX_WAIT_MS = 60 * 60 * 1000
const INTERVAL_MS = 8000

/**
 * Watch queued content audits until every one reaches a terminal state.
 *
 * The portal did this with `setInterval` plus a manual re-render. React Query
 * owns the timer here — it stops polling when the tab is hidden and resumes on
 * focus, which the hand-rolled version could not — and the callback asks Next
 * to refresh the route so the server components re-read the queue.
 */
export function useContentAuditPoll(onChange: () => void) {
  const [urls, setUrls] = useState<string[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const enabled = urls.length > 0

  const { data } = useQuery({
    queryKey: ['audit-content-status', urls],
    queryFn: () => getContentAuditStatuses(urls),
    enabled,
    refetchInterval: enabled ? INTERVAL_MS : false,
  })

  useEffect(() => {
    if (!enabled || !data) return

    const stillWaiting = urls.filter((url) => {
      const status = data[url]
      return status !== 'done' && status !== 'error'
    })

    const timedOut = startedAt != null && Date.now() - startedAt > MAX_WAIT_MS

    if (stillWaiting.length !== urls.length) onChange()

    if (!stillWaiting.length || timedOut) {
      setUrls([])
      setStartedAt(null)
    } else {
      setUrls(stillWaiting)
    }
    // `onChange` is a fresh closure each render; depending on it would restart
    // the effect every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled])

  return {
    watch: (next: string[]) => {
      setUrls(next)
      setStartedAt(Date.now())
    },
    watching: urls.length,
  }
}
