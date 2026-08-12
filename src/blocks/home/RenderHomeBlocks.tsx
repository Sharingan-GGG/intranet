import React, { Fragment, Suspense } from 'react'

import type { Page } from '@/payload-types'

import { GreetingBarBlockComponent } from '@/blocks/home/GreetingBar/Component'
import { FeaturedSpotlightBlockComponent } from '@/blocks/home/FeaturedSpotlight/Component'
import { QuickLinksBlockComponent } from '@/blocks/home/QuickLinks/Component'
import { TimeZonesBlockComponent } from '@/blocks/home/TimeZones/Component'
import { KnowledgeBaseBlockComponent } from '@/blocks/home/KnowledgeBase/Component'
import { EventsBlockComponent } from '@/blocks/home/Events/Component'
import { NewsSliderBlockComponent } from '@/blocks/home/NewsSlider/Component'
import { EdmSliderBlockComponent } from '@/blocks/home/EDMSlider/Component'
import { FeedbackBlockComponent } from '@/blocks/home/Feedback/Component'

type HomeBlock = Page['layout'][0]

const blockComponents: Partial<Record<HomeBlock['blockType'], React.FC<never>>> = {
  greetingBar: GreetingBarBlockComponent,
  featuredSpotlight: FeaturedSpotlightBlockComponent,
  quickLinks: QuickLinksBlockComponent,
  timeZones: TimeZonesBlockComponent,
  knowledgeBase: KnowledgeBaseBlockComponent,
  eventsBlock: EventsBlockComponent,
  newsSlider: NewsSliderBlockComponent,
  edmSlider: EdmSliderBlockComponent,
  feedback: FeedbackBlockComponent,
}

/**
 * A `main` block immediately followed by a `side` block renders as one
 * two-column grid row; unpaired blocks stack full-width.
 */
const pairing: Partial<Record<HomeBlock['blockType'], { role: 'main'; gridClass: string } | { role: 'side' }>> = {
  featuredSpotlight: { role: 'main', gridClass: 'il-grid-hero' },
  knowledgeBase: { role: 'main', gridClass: 'il-grid-kb' },
  quickLinks: { role: 'side' },
  eventsBlock: { role: 'side' },
}

/** Approximate rendered height per block, so its streamed-in fallback doesn't shift layout. */
const FALLBACK_HEIGHT: Partial<Record<HomeBlock['blockType'], number>> = {
  featuredSpotlight: 330,
  knowledgeBase: 260,
  quickLinks: 220,
  eventsBlock: 220,
  newsSlider: 260,
  edmSlider: 220,
  timeZones: 140,
}

const HomeBlockFallback: React.FC<{ minHeight: number }> = ({ minHeight }) => (
  <div
    style={{ minHeight, borderRadius: 20, background: 'var(--il-border)', opacity: 0.4 }}
    aria-hidden
  />
)

const renderBlock = (block: HomeBlock, index: number, userName?: string) => {
  const Block = blockComponents[block.blockType] as React.FC<Record<string, unknown>> | undefined
  if (!Block) return null
  const extraProps = block.blockType === 'greetingBar' ? { userName } : {}
  return (
    <Suspense
      key={block.id ?? index}
      fallback={<HomeBlockFallback minHeight={FALLBACK_HEIGHT[block.blockType] ?? 160} />}
    >
      <Block {...block} {...extraProps} />
    </Suspense>
  )
}

export const RenderHomeBlocks: React.FC<{
  blocks: Page['layout']
  userName?: string
  /**
   * Home blocks this user's role/department grants (e.g. 'home:knowledgeBase').
   * Undefined or empty means "no Permission rules configured yet" — show
   * everything rather than blanking the homepage.
   */
  visiblePages?: Set<string>
  /** Blocks explicitly excluded — wins even over "All" or an empty visiblePages. */
  excludedPages?: Set<string>
}> = ({ blocks, userName, visiblePages, excludedPages }) => {
  if (!blocks?.length) return null

  const isVisible = (block: HomeBlock) => {
    const key = `home:${block.blockType}`
    if (excludedPages?.has('all') || excludedPages?.has(key)) return false
    return !visiblePages || visiblePages.size === 0 || visiblePages.has('all') || visiblePages.has(key)
  }

  const filteredBlocks = blocks.filter(isVisible)

  const rendered: React.ReactNode[] = []
  for (let i = 0; i < filteredBlocks.length; i++) {
    const block = filteredBlocks[i]
    const next = filteredBlocks[i + 1]
    const pair = pairing[block.blockType]

    if (pair?.role === 'main' && next && pairing[next.blockType]?.role === 'side') {
      rendered.push(
        <div className={pair.gridClass} key={block.id ?? i}>
          {renderBlock(block, i, userName)}
          {renderBlock(next, i + 1, userName)}
        </div>,
      )
      i++
      continue
    }

    rendered.push(renderBlock(block, i, userName))
  }

  return <Fragment>{rendered}</Fragment>
}
