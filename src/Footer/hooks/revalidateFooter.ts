import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { after } from 'next/server'

export const revalidateFooter: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating footer`)

    after(() => revalidateTag('global_footer', 'max'))
  }

  return doc
}
