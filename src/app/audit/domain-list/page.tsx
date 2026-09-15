import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { SITES } from '@/lib/audit-config'
import { auditPath, DEFAULT_DASHBOARD_TAB } from '@/lib/audit-route'
import { getAuditSession } from '@/lib/audit-user'
import { fetchCounts } from '@/lib/audit-wordpress'
import { TYPE_LABELS } from '@/lib/audit-types'

/**
 * Domain List — one card per configured site with live published counts.
 *
 * The counts come from WordPress's `X-WP-Total` header with `per_page=1`, so
 * this whole screen is three tiny requests per site and no bodies. They are
 * cached by the WordPress layer, so revisiting is free; adding a site is still
 * one entry in `SITES`.
 */
export const metadata: Metadata = { title: 'Domain List | Audit Hub' }

export default async function AuditDomainListPage() {
  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit')
  if (!canAccess) return <AuditAccessDenied />

  const counts = await Promise.all(SITES.map((site) => fetchCounts(site)))

  return (
    <div className="shell">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">CTG Audit Hub</p>
          <h1 className="text-2xl font-bold">Domain List</h1>
        </div>
        <div className="flex gap-2">
          <Link
            className="btn btn-sm"
            href={auditPath({ screen: 'dashboard', tab: DEFAULT_DASHBOARD_TAB })}
          >
            Dashboard
          </Link>
          <Link className="btn btn-sm" href={auditPath({ screen: 'completed' })}>
            Completed
          </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SITES.map((site, index) => (
          <Link
            key={site.domain}
            href={`${auditPath({ screen: 'dashboard', tab: DEFAULT_DASHBOARD_TAB })}?domain=${site.domain}`}
            className="card block p-5 transition-shadow hover:shadow-md"
          >
            <p className="eyebrow">{site.short}</p>
            <h2 className="mt-1 text-lg font-bold">{site.label}</h2>
            <p className="muted small">{site.domain}</p>
            <div className="mt-4 flex gap-5">
              {site.types.map((type) => (
                <div key={type}>
                  <p className="tnum text-xl font-bold">
                    {/* undefined means the request failed; 0 means the CPT
                        genuinely isn't registered on this site. */}
                    {counts[index]?.[type] ?? '—'}
                  </p>
                  <p className="eyebrow">{TYPE_LABELS[type]}</p>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
