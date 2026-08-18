import type { CollectionAfterChangeHook } from 'payload'

// Reuses Payload's built-in `schedulePublish` task (auto-registered because
// `versions.drafts.schedulePublish` is enabled on Posts) to flip the post to
// draft once its Expiry Date passes — the same mechanism the admin UI's
// "Schedule Publish" popup uses, just driven by the Expiry Date field instead.
export const scheduleExpiry: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const { payload } = req
  // Payload's admin panel calls create() internally to seed a draft when the
  // "Create new" view first opens — previousDoc is {} then, so there's no prior
  // schedulePublish job to clean up, and Payload's own deleteUserPreferences
  // cleanup throws on the empty match set for a brand-new document.
  const isNewDoc = !previousDoc?.id

  if (!isNewDoc && doc.expiryDate === previousDoc?.expiryDate && doc._status === previousDoc?._status) {
    return doc
  }

  if (!isNewDoc) {
    await payload.delete({
      collection: 'payload-jobs',
      req,
      where: {
        and: [
          { completedAt: { exists: false } },
          { taskSlug: { equals: 'schedulePublish' } },
          { 'input.doc.value': { equals: doc.id } },
          { 'input.doc.relationTo': { equals: 'posts' } },
          { 'input.type': { equals: 'unpublish' } },
        ],
      },
    })
  }

  if (doc._status === 'published' && doc.expiryDate) {
    const expiresAt = new Date(doc.expiryDate)

    if (expiresAt.getTime() > Date.now()) {
      await payload.jobs.queue({
        task: 'schedulePublish',
        input: {
          type: 'unpublish',
          doc: { relationTo: 'posts', value: doc.id },
        },
        waitUntil: expiresAt,
        req,
      })
    }
  }

  return doc
}
