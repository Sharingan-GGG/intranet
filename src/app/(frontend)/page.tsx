import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import React from 'react'

import {
  getEdms,
  getEventGroups,
  getFeaturedNews,
  getKbDocs,
  getNews,
  getOffices,
  getQuickLinks,
} from '@/lib/homeData'
import { GreetingBar } from '@/components/home/GreetingBar'
import { FeaturedSpotlight } from '@/components/home/FeaturedSpotlight'
import { QuickLinks } from '@/components/home/QuickLinks'
import { TimeZones } from '@/components/home/TimeZones'
import { KnowledgeBase } from '@/components/home/KnowledgeBase'
import { Events } from '@/components/home/Events'
import { NewsSlider } from '@/components/home/NewsSlider'
import { EDMSlider } from '@/components/home/EDMSlider'
import { Feedback } from '@/components/home/Feedback'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })
  const [{ user }, quickLinks, offices, kbDocs, eventGroups, news, edms, featured] =
    await Promise.all([
      payload.auth({ headers: await getHeaders() }),
      getQuickLinks(),
      getOffices(),
      getKbDocs(),
      getEventGroups(),
      getNews(),
      getEdms(),
      getFeaturedNews(),
    ])

  const firstName = user?.name?.trim().split(/\s+/)[0]
  const eventCount = eventGroups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="il-root il-page">
      <main className="il-main">
        {/* Greeting + featured spotlight + quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <GreetingBar userName={firstName} eventCount={eventCount} />
          <div className="il-grid-hero">
            <FeaturedSpotlight items={featured} />
            <QuickLinks links={quickLinks} />
          </div>
        </div>

        {/* Live office clocks */}
        <TimeZones offices={offices} />

        {/* Knowledge base + upcoming events */}
        <div className="il-grid-kb">
          <KnowledgeBase documents={kbDocs} />
          <Events groups={eventGroups} />
        </div>

        {/* Sliders */}
        <NewsSlider items={news} />
        <EDMSlider items={edms} />

        {/* Feedback */}
        <Feedback />
      </main>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'CTG Intranet — Home',
  description: 'The home base for everything CTG — tools, news, documents and people, in one place.',
}
