'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

export type PostsSort = 'newest' | 'oldest' | 'az' | 'za'

const SORT_OPTIONS: { value: PostsSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'Title A–Z' },
  { value: 'za', label: 'Title Z–A' },
]

const pillStyle = (active: boolean): React.CSSProperties => ({
  border: '1px solid',
  borderColor: active ? 'var(--il-brand)' : 'var(--il-border)',
  background: active ? 'var(--il-brand)' : '#fff',
  color: active ? '#fff' : 'var(--il-text)',
  fontSize: 13,
  fontWeight: 600,
  padding: '7px 14px',
  borderRadius: 999,
  cursor: 'pointer',
})

export const PostsControls: React.FC<{
  categories: { slug: string; title: string }[]
  activeCategory?: string
  activeSort: PostsSort
}> = ({ categories, activeCategory, activeSort }) => {
  const router = useRouter()

  const navigate = (category: string | undefined, sort: PostsSort) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (sort !== 'newest') params.set('sort', sort)
    const qs = params.toString()
    router.push(qs ? `/posts?${qs}` : '/posts')
  }

  return (
    <div className="il-posts-controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      <div
        role="tablist"
        aria-label="Filter by category"
        className="il-tabs"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, minWidth: 0 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={!activeCategory}
          style={pillStyle(!activeCategory)}
          onClick={() => navigate(undefined, activeSort)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            role="tab"
            aria-selected={activeCategory === c.slug}
            style={pillStyle(activeCategory === c.slug)}
            onClick={() => navigate(c.slug, activeSort)}
          >
            {c.title}
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--il-text-body)' }}>
        Sort
        <select
          value={activeSort}
          onChange={(e) => navigate(activeCategory, e.target.value as PostsSort)}
          style={{
            border: '1px solid var(--il-border)',
            borderRadius: 10,
            padding: '7px 10px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--il-text)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
