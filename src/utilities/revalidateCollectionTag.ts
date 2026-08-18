import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { after } from 'next/server'

/**
 * Builds afterChange/afterDelete hooks that invalidate the unstable_cache tag(s)
 * a homeData.ts fetcher was cached under, mirroring src/Header/hooks/revalidateHeader.ts.
 *
 * Deferred via `after()` because Payload's admin panel can trigger these hooks
 * (e.g. creating a draft doc) from inside an RSC render, where Next 16 forbids
 * calling revalidateTag directly.
 */
export const makeRevalidateCollectionTags = (...tags: string[]) => {
  const afterChange: CollectionAfterChangeHook = ({ doc, req: { payload, context } }) => {
    if (!context.disableRevalidate) {
      payload.logger.info(`Revalidating tags: ${tags.join(', ')}`)
      after(() => tags.forEach((tag) => revalidateTag(tag, 'max')))
    }
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
    if (!context.disableRevalidate) {
      after(() => tags.forEach((tag) => revalidateTag(tag, 'max')))
    }
    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
