import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidateTag } from 'next/cache'

/**
 * Builds afterChange/afterDelete hooks that invalidate the unstable_cache tag(s)
 * a homeData.ts fetcher was cached under, mirroring src/Header/hooks/revalidateHeader.ts.
 */
export const makeRevalidateCollectionTags = (...tags: string[]) => {
  const afterChange: CollectionAfterChangeHook = ({ doc, req: { payload, context } }) => {
    if (!context.disableRevalidate) {
      payload.logger.info(`Revalidating tags: ${tags.join(', ')}`)
      tags.forEach((tag) => revalidateTag(tag, 'max'))
    }
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
    if (!context.disableRevalidate) {
      tags.forEach((tag) => revalidateTag(tag, 'max'))
    }
    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
