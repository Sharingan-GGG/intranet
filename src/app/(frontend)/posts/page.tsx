import type { Metadata } from 'next/types'
import type { Where } from 'payload'

import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { PostsControls, type PostsSort } from './PostsControls'
import { NewsCardItem } from '@/components/home/NewsCardItem'
import { postToNewsCard } from '@/lib/homeData'

export const dynamic = 'force-dynamic'

const SORTS: Record<PostsSort, string> = {
  newest: '-publishedAt',
  oldest: 'publishedAt',
  az: 'title',
  za: '-title',
}

type Args = {
  searchParams: Promise<{
    sort?: string
    category?: string
    page?: string
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { sort: sortParam, category, page: pageParam } = await searchParamsPromise
  const sort: PostsSort = sortParam && sortParam in SORTS ? (sortParam as PostsSort) : 'newest'
  const page = Math.max(1, Number(pageParam) || 1)

  const payload = await getPayload({ config: configPromise })

  // Sub-categories of the parent `News` category — the filter tabs.
  const { docs: subcategories } = await payload.find({
    collection: 'categories',
    where: { 'parent.slug': { equals: 'news' } },
    sort: 'order',
    limit: 50,
    depth: 0,
  })

  const activeCategory = subcategories.find((c) => c.slug === category)

  let where: Where | undefined
  if (activeCategory) {
    where = { categories: { in: [activeCategory.id] } }
  }

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page,
    overrideAccess: false,
    sort: SORTS[sort],
    where,
  })

  const cards = posts.docs.map(postToNewsCard)

  // Query string (without `page`) so pagination keeps the active filters.
  const params = new URLSearchParams()
  if (activeCategory?.slug) params.set('category', activeCategory.slug)
  if (sort !== 'newest') params.set('sort', sort)
  const query = params.toString()

  return (
    <div className="il-root il-page">
      <PageClient />
      <main className="il-main" style={{ paddingBottom: 40 }}>
        <div className="il-posts-header" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#112E81', letterSpacing: '-0.01em' }}>
            News &amp; Posts
          </h1>

          <PostsControls
            categories={subcategories.map((c) => ({ slug: c.slug ?? '', title: c.title }))}
            activeCategory={activeCategory?.slug ?? undefined}
            activeSort={sort}
          />

          <div style={{ fontSize: 13, color: '#5A6478' }}>
            <PageRange collection="posts" currentPage={posts.page} limit={12} totalDocs={posts.totalDocs} />
          </div>
        </div>

        {cards.length > 0 ? (
          <div
            className="il-posts-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: 24,
              alignItems: 'stretch',
            }}
          >
            {cards.map((card, i) => (
              <NewsCardItem key={i} card={card} width="100%" />
            ))}
          </div>
        ) : (
          <div
            className="il-posts-empty"
            style={{
              background: '#fff',
              border: '1px solid #E3EBF1',
              borderRadius: 18,
              padding: '36px 24px',
              textAlign: 'center',
              fontSize: 13.5,
              color: '#8A94A6',
            }}
          >
            No posts in this category yet.
          </div>
        )}

        {posts.totalPages > 1 && posts.page && (
          <Pagination page={posts.page} totalPages={posts.totalPages} query={query} />
        )}
      </main>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `CTG Intranet — Posts`,
  }
}
