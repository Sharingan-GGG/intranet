import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'

/**
 * Deduped per-request session lookup. Header and the page both need the signed-in
 * user on every render; without React.cache each one re-verifies the session.
 */
export const getCachedAuth = cache(async () => {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })
  return { payload, user }
})
