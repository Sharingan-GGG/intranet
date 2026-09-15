'use client'

/**
 * The Audit Hub's top bar: brand on the left, then the screens, then Home and
 * the theme switch on the right. Cloned from the portal's
 * <header class="topbar">, which is where Domain List lives — it is a screen,
 * not a filter, so it belongs beside Dashboard rather than in the list
 * toolbar.
 */
import { HomeIcon, MoonIcon, SunIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { BASE_PATH, auditPath } from '@/lib/audit-route'

/**
 * Matched on the leading segments, not `includes`: `completed` is also a
 * Dashboard tab slug, so `/audit/scheduler/completed/...` contains the string
 * "/completed" while belonging to the Dashboard.
 *
 * The standalone `/audit/completed` screen is deliberately absent. It is the
 * same list as the Dashboard's Completed tab, and two routes to one list meant
 * two places to keep in step; the route still resolves so old links and the
 * Back target on reports opened from it survive.
 */
const NAV: { label: string; href: string; match: (path: string) => boolean }[] = [
  {
    label: 'Dashboard',
    href: auditPath({ screen: 'dashboard', tab: 'content-pre-check' }),
    match: (p) => p.startsWith(`${BASE_PATH}/scheduler`) || /\/audit\/?$/.test(p),
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

        <div className="tb-tools">
          <Link className="tb-icon" href="/" title="Intranet home" aria-label="Intranet home">
            <HomeIcon size={16} aria-hidden />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

/**
 * Light/dark switch for the hub.
 *
 * `resolvedTheme` is only known in the browser, so the icon is held back until
 * after mount — rendering the moon on the server and the sun on the client is
 * a hydration mismatch, and the usual workaround of reading localStorage
 * during render is the same bug. The button itself renders immediately so the
 * bar does not reflow when the icon arrives.
 */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dark = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      className="tb-icon"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {mounted && (dark ? <SunIcon size={16} aria-hidden /> : <MoonIcon size={16} aria-hidden />)}
    </button>
  )
}
