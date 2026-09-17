import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { AuditTraffic } from '@/components/work/audit/traffic'
import { DEFAULT_SITE, siteByDomain } from '@/lib/audit-config'
import {
  loadGa4Channels,
  loadGa4Freshness,
  loadGa4PageEngagement,
  loadGa4PropertyForDomain,
  loadGa4Summary,
} from '@/lib/audit-ga4'
import { GA4_ALL_CHANNELS, resolveGa4Range, type Ga4Cards } from '@/lib/audit-types'
import { getAuditSession } from '@/lib/audit-user'

/**
 * Traffic — GA4 numbers for one site, shaped like the Dashboard.
 *
 * Same contract as the Dashboard: the site lives in `?domain=`, defaults to
 * RAT AU, and the table lists that site's pages. What differs is where the rows
 * come from — the Dashboard's spine is WordPress, this one's is GA4.
 *
 * `?channel=` filters to one default channel group, which matters here more
 * than it looks: paid is the majority of all traffic on both properties, so an
 * unfiltered figure read next to an SEO score flatters work SEO had no part in.
 *
 * Everything on screen is live. `audit.ga4_daily` backs none of it — the cards
 * need key events and three GA-computed ratios that the snapshot does not hold,
 * and splitting them by channel needs a dimension it does not have. The
 * snapshot remains the historical store the nightly ingest keeps warm.
 */
export const metadata: Metadata = { title: 'Traffic | Audit Hub' }
export const revalidate = 0

type Props = { searchParams: Promise<{ days?: string; domain?: string; channel?: string }> }

export default async function AuditTrafficPage({ searchParams }: Props) {
  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit/traffic')
  if (!canAccess) return <AuditAccessDenied />

  const params = await searchParams
  const days = resolveGa4Range(params.days)
  // siteByDomain falls back to DEFAULT_SITE, which is what we want here: an
  // unknown ?domain= lands on RAT AU rather than on an empty screen.
  const site = params.domain ? siteByDomain(params.domain) : DEFAULT_SITE
  const channel = params.channel?.trim() || GA4_ALL_CHANNELS
  const filter = channel === GA4_ALL_CHANNELS ? undefined : channel

  const [propertyId, freshness] = await Promise.all([
    loadGa4PropertyForDomain(site.domain),
    loadGa4Freshness(),
  ])

  let cards: Ga4Cards | null = null
  let channels: Awaited<ReturnType<typeof loadGa4Channels>>['list'] = []
  let pages = null
  let error: string | null = null

  if (propertyId) {
    try {
      // Three live calls, in parallel: the channel split (chips, and the two
      // composition cards), the four filter-sensitive cards, and the table.
      const [channelData, summary, pageRows] = await Promise.all([
        loadGa4Channels(propertyId, days),
        loadGa4Summary(propertyId, days, filter),
        loadGa4PageEngagement(propertyId, days, filter),
      ])
      channels = channelData.list
      pages = pageRows
      cards = { ...channelData.composition, ...summary }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load GA4 data.'
    }
  }

  return (
    <AuditTraffic
      site={site}
      days={days}
      channel={channel}
      channels={channels}
      cards={cards}
      hasProperty={Boolean(propertyId)}
      pages={pages}
      error={error}
      freshness={freshness}
    />
  )
}
