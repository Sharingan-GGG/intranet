'use server'

import { redirect } from 'next/navigation'

import { getAuditSession } from '@/lib/audit-user'
import { isChallenge, issueConnectCode, safeReturnUrl, siteForHost } from '@/lib/audit-wp'

/**
 * Approve or cancel a WordPress plugin's Connect request.
 *
 * Everything is re-validated from the form here — the page's checks only
 * decide what gets rendered, and a server action is reachable by anyone who
 * can post to it. Approving needs a signed-in user with Audit Hub access.
 */
export async function answerWpConnect(formData: FormData): Promise<void> {
  const site = siteForHost(formData.get('site'))
  const back = site ? safeReturnUrl(formData.get('return'), site) : null
  const state = formData.get('state')
  const challenge = formData.get('challenge')
  if (!site || !back || typeof state !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(state)) {
    redirect('/audit')
  }

  back.searchParams.set('state', state)

  if (formData.get('decision') !== 'approve' || !isChallenge(challenge)) {
    back.searchParams.set('error', 'access_denied')
    redirect(back.toString())
  }

  const { user, canAccess } = await getAuditSession()
  if (!user || !canAccess) {
    back.searchParams.set('error', 'access_denied')
    redirect(back.toString())
  }

  const code = await issueConnectCode(site.domain, challenge, user.email)
  back.searchParams.set('code', code)
  redirect(back.toString())
}
