import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { getAuditSession } from '@/lib/audit-user'
import { isChallenge, safeReturnUrl, siteForHost } from '@/lib/audit-wp'

import { answerWpConnect } from './actions'

/**
 * Approval screen for the WordPress plugin's Connect button.
 *
 *   /audit/wp-connect?site=<wp host>&return=<wp admin-post url>&state=…&challenge=…
 *
 * Signed-out visitors are sent to /login by middleware and come back here with
 * the query intact. Nothing is issued on GET: the key is only minted after an
 * explicit Connect click, so a link cannot connect a site on someone's behalf.
 */
export const metadata: Metadata = { title: 'Connect WordPress | Audit Hub' }

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

/** Which intranet this is, from its own public URL — shown so nobody connects the wrong one. */
function environmentLabel(): string {
  const url = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  if (url.includes('staging.')) return 'Staging'
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'Local'
  return 'Production'
}

export default async function WpConnectPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  const { user, canAccess } = await getAuditSession()
  if (!user) {
    const q = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
    )
    redirect(`/login?redirect=${encodeURIComponent(`/audit/wp-connect?${q}`)}`)
  }
  if (!canAccess) return <AuditAccessDenied />

  const site = siteForHost(one(params.site))
  const back = site ? safeReturnUrl(one(params.return), site) : null
  const state = one(params.state)
  const challenge = one(params.challenge)
  const valid = site && back && state && isChallenge(challenge)
  const env = environmentLabel()

  return (
    <div className="shell py-16">
      <div className="card mx-auto max-w-lg p-8">
        <p className="eyebrow">CTG Audit Hub · {env}</p>
        {!valid ? (
          <>
            <h1 className="mt-2 text-xl font-bold">This connect link is not valid</h1>
            <p className="muted mt-3 text-sm">
              Start again from <strong>Settings → Audit Hub → Connect</strong> in WordPress. The link
              must come from one of the Audit Hub&rsquo;s sites and point back to its own admin.
            </p>
          </>
        ) : (
          <form action={answerWpConnect}>
            <h1 className="mt-2 text-xl font-bold">Connect {site.label}?</h1>
            <p className="muted mt-3 text-sm">
              The Audit Hub plugin on <strong>{back.host}</strong> is asking to connect to the{' '}
              <strong>{env}</strong> Audit Hub. It will be able to queue audits and full scans for{' '}
              <strong>{site.domain}</strong> and read their status — nothing else.
            </p>
            <p className="muted mt-3 text-sm">
              A new key is created and sent straight to the site. If it was already connected, its
              old key stops working. Approving as <strong>{user.email}</strong>.
            </p>
            <input type="hidden" name="site" value={one(params.site)} />
            <input type="hidden" name="return" value={back.toString()} />
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="challenge" value={challenge} />
            <div className="mt-6 flex gap-2">
              <button className="btn btn-primary" type="submit" name="decision" value="approve">
                Connect
              </button>
              <button className="btn" type="submit" name="decision" value="cancel">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
