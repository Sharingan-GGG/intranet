import type { Metadata } from 'next'
import React from 'react'

import type { Page } from '@/payload-types'

import { RenderHomeBlocks } from '@/blocks/home/RenderHomeBlocks'
import { HardcodedHome } from '@/components/home/HardcodedHome'
import { resolveUserPermissions } from '@/access/departmentPermissions'
import { getCachedAuth } from '@/utilities/getCachedAuth'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { payload, user } = await getCachedAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const { pages: visiblePages, excludedPages } = await resolveUserPermissions(payload, user)

  let layout: Page['layout'] | undefined
  try {
    const result = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'home' } },
      limit: 1,
      pagination: false,
      depth: 1,
    })
    layout = result.docs[0]?.layout
  } catch (err) {
    payload.logger.error({ err }, 'Failed to fetch the home page doc; falling back to hardcoded home')
  }

  return (
    <div className="il-root il-page">
      <main className="il-main">
        {layout?.length ? (
          <RenderHomeBlocks
            blocks={layout}
            userName={firstName}
            visiblePages={visiblePages}
            excludedPages={excludedPages}
          />
        ) : (
          <HardcodedHome userName={firstName} />
        )}
      </main>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'CTG Intranet — Home',
  description: 'The home base for everything CTG — tools, news, documents and people, in one place.',
}
