import React from 'react'

import {
  getEdmCategories,
  getEdms,
  getEventGroups,
  getFeaturedNews,
  getKbCategories,
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

/**
 * The original hardcoded homepage composition. Rendered as a fallback when
 * the CMS `home` page doc is missing or has an empty layout, so the site
 * never blanks.
 */
export const HardcodedHome: React.FC<{ userName?: string }> = async ({ userName }) => {
  const [quickLinks, offices, kbDocs, kbCategories, eventGroups, news, edms, edmCategories, featured] =
    await Promise.all([
      getQuickLinks(),
      getOffices(),
      getKbDocs(),
      getKbCategories(),
      getEventGroups(),
      getNews(),
      getEdms(),
      getEdmCategories(),
      getFeaturedNews(),
    ])

  return (
    <>
      {/* Greeting + featured spotlight + quick links */}
      <div className="il-hero-group" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <GreetingBar userName={userName} />
        <div className="il-grid-hero">
          <FeaturedSpotlight items={featured} />
          <QuickLinks links={quickLinks} />
        </div>
      </div>

      {/* Live office clocks */}
      <TimeZones offices={offices} />

      {/* Knowledge base + upcoming events */}
      <div className="il-grid-kb">
        <KnowledgeBase documents={kbDocs} categories={kbCategories} />
        <Events groups={eventGroups} />
      </div>

      {/* Sliders */}
      <NewsSlider items={news} />
      <EDMSlider items={edms} categories={edmCategories} />

      {/* Org chart + feedback */}
      <Feedback />
    </>
  )
}
