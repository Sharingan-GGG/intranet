import type { CollectionAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { after } from 'next/server'

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { payload } }) => {
  payload.logger.info(`Revalidating redirects`)

  after(() => revalidateTag('redirects', 'max'))

  return doc
}
