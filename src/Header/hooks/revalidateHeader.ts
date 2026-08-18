import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { after } from 'next/server'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating header`)

    after(() => revalidateTag('global_header', 'max'))
  }

  return doc
}
