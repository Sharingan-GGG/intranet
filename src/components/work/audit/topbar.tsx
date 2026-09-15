'use client'

/**
 * The Audit Hub's top bar: brand on the left, then the three screens. Cloned
 * from the portal's <header class="topbar">, which is where Completed and
 * Domain List live — they are screens, not filters, so they belong beside
 * Dashboard rather than in the list toolbar.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { BASE_PATH, auditPath } from '@/lib/audit-route'

/**
 * Matched on the leading segments, not `includes`. `completed` is both a
 * screen and a Dashboard tab, so `/audit/scheduler/completed/...` contains
 * the string "/completed" while belonging to the Dashboard — an `includes`
 * test lights both items at once.
 */
const NAV: { label: string; href: string; match: (path: string) => boolean }[] = [
  {
    label: 'Dashboard',
    href: auditPath({ screen: 'dashboard', tab: 'content-pre-check' }),
    match: (p) => p.startsWith(`${BASE_PATH}/scheduler`) || /\/audit\/?$/.test(p),
  },
  {
    label: 'Completed',
    href: auditPath({ screen: 'completed' }),
    match: (p) => p.startsWith(`${BASE_PATH}/completed`),
  },
  {
    label: 'Domain List',
    href: auditPath({ screen: 'domain-list' }),
    match: (p) => p.startsWith(`${BASE_PATH}/domain-list`),
  },
]

export function AuditTopbar() {
  const pathname = usePathname() ?? ''

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ctg-icon.png" alt="CTG" className="brand-mark" />
          <span>
            CTG Audit Hub<small>SEO &amp; GEO</small>
          </span>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={item.match(pathname) ? 'cur' : undefined}
              aria-current={item.match(pathname) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="tb-spacer" />
      </div>
    </header>
  )
}
