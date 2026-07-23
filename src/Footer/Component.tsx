import Link from 'next/link'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { BackToTop } from './BackToTop'

/** Resolve a footer nav item's href (custom URL or CMS reference). */
const navHref = (link: NonNullable<FooterType['navItems']>[number]['link']): string => {
  if (link.type === 'reference' && link.reference && typeof link.reference.value === 'object') {
    const { relationTo, value } = link.reference
    const slug = (value as { slug?: string }).slug
    return `${relationTo !== 'pages' ? `/${relationTo}` : ''}/${slug ?? ''}`
  }
  return link.url ?? '#'
}

export async function Footer() {
  const data = (await getCachedGlobal('footer', 1)()) as FooterType
  const navItems = data?.navItems ?? []

  return (
    <footer className="il-root il-footer" style={{ background: 'var(--il-brand)', marginTop: 50, padding: '44px 32px 26px' }}>
      <div
        style={{
          maxWidth: 1312,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 36,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ctg-icon.png" alt="CTG logo" width={30} height={30} style={{ display: 'block', borderRadius: '50%' }} />
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>
              CTG <span style={{ fontWeight: 400, opacity: 0.75 }}>Intranet</span>
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>
            The home base for everything CTG — tools, news, documents and people, in one place.
          </div>
        </div>

        {navItems.length > 0 && (
          <div>
            <div
              style={{
                color: '#AACCD6',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 13,
              }}
            >
              Quick Links
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {navItems.map(({ link, id }, i) => (
                <Link
                  key={id ?? i}
                  href={navHref(link)}
                  className="il-footer-link"
                  style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, textDecoration: 'none' }}
                  {...(link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          maxWidth: 1312,
          margin: '34px auto 0',
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5 }}>© 2026 CTG. Internal use only.</div>
        <BackToTop />
      </div>
    </footer>
  )
}
