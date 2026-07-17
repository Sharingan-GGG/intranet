/**
 * Idempotent seed for the CMS-driven homepage.
 *
 * Creates (or updates) the `pages` doc with slug `home`, setting its layout
 * to the nine home blocks in the current visual order. Skips the update when
 * home blocks are already present unless `--force` is passed.
 *
 * Run: pnpm payload run src/scripts/seed-home-page.ts [--force]
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import type { Page } from '@/payload-types'

const layout: Page['layout'] = [
  { blockType: 'greetingBar' },
  { blockType: 'featuredSpotlight', limit: 3 },
  { blockType: 'quickLinks' },
  { blockType: 'timeZones' },
  { blockType: 'knowledgeBase' },
  { blockType: 'eventsBlock' },
  { blockType: 'newsSlider', limit: 12 },
  { blockType: 'edmSlider', limit: 12 },
  { blockType: 'feedback' },
]

const payload = await getPayload({ config: configPromise })
const force = process.argv.includes('--force')

const existing = await payload.find({
  collection: 'pages',
  where: { slug: { equals: 'home' } },
  limit: 1,
  pagination: false,
})

const doc = existing.docs[0]

if (doc) {
  const hasHomeBlocks = doc.layout?.some((b) => b.blockType === 'greetingBar')
  if (hasHomeBlocks && !force) {
    payload.logger.info('Home page already has home blocks — nothing to do (use --force to overwrite).')
  } else {
    await payload.update({
      collection: 'pages',
      id: doc.id,
      data: { layout, _status: 'published' },
      context: { disableRevalidate: true },
    })
    payload.logger.info(`Updated home page (id ${doc.id}) with ${layout.length} home blocks.`)
  }
} else {
  const created = await payload.create({
    collection: 'pages',
    data: {
      title: 'Home',
      slug: 'home',
      _status: 'published',
      hero: { type: 'none' },
      layout,
    },
    context: { disableRevalidate: true },
  })
  payload.logger.info(`Created home page (id ${created.id}) with ${layout.length} home blocks.`)
}

process.exit(0)
