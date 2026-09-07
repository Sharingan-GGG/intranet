import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidateTag } from 'next/cache'

import { safeAfter } from './safeAfter'

/**
 * Builds afterChange/afterDelete hooks that invalidate the unstable_cache tag(s)
 * a homeData.ts fetcher was cached under, mirroring src/Header/hooks/revalidateHeader.ts.
 *
 * Deferred via `safeAfter()` because Payload's admin panel can trigger these
 * hooks (e.g. creating a draft doc) from inside an RSC render, where Next 16
 * forbids calling revalidateTag directly — and because writes also arrive from
 * outside any request scope at all, where `after()` itself throws.
 */
export const makeRevalidateCollectionTags = (...tags: string[]) => {
  const afterChange: CollectionAfterChangeHook = ({ doc, req: { payload, context } }) => {
    if (!context.disableRevalidate) {
      payload.logger.info(`Revalidating tags: ${tags.join(', ')}`)
      safeAfter(() => tags.forEach((tag) => revalidateTag(tag, 'max')))
    }
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
    if (!context.disableRevalidate) {
      safeAfter(() => tags.forEach((tag) => revalidateTag(tag, 'max')))
    }
    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
