import React, { Fragment } from 'react'

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

const renderBlock = (block: HomeBlock, index: number, userName?: string) => {
  const Block = blockComponents[block.blockType] as React.FC<Record<string, unknown>> | undefined
  if (!Block) return null
  const extraProps = block.blockType === 'greetingBar' ? { userName } : {}
  return <Block key={block.id ?? index} {...block} {...extraProps} />
}

export const RenderHomeBlocks: React.FC<{
  blocks: Page['layout']
  userName?: string
}> = ({ blocks, userName }) => {
  if (!blocks?.length) return null

  const rendered: React.ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const next = blocks[i + 1]
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
