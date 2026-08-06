import type { PayloadHandler } from 'payload'

import { hasAdminCollectionAccess } from '@/access/departmentPermissions'
import { createServiceClient } from '@/lib/supabase/server'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB
const ALLOWED_MIME_PREFIXES = ['image/', 'video/']
const BUCKET = 'media'

const sanitizeFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')

/**
 * Issues a Supabase signed upload URL so the browser can PUT the file straight to Storage,
 * bypassing the Vercel serverless function's ~4.5MB request body cap. The client then creates
 * the Media doc with the resulting metadata only (see Media.ts's filesRequiredOnCreate: false).
 */
export const presignMediaUpload: PayloadHandler = async (req) => {
  const hasAccess = await hasAdminCollectionAccess(req.payload, req.user, 'media')
  if (!hasAccess) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json?.()) as
    | { filename?: string; fileSize?: number; mimeType?: string }
    | undefined
  const { filename, fileSize, mimeType } = body ?? {}

  if (!filename || !mimeType || typeof fileSize !== 'number') {
    return Response.json({ error: 'filename, mimeType and fileSize are required' }, { status: 400 })
  }
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return Response.json({ error: `Unsupported mimeType: ${mimeType}` }, { status: 400 })
  }
  if (fileSize > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit` },
      { status: 400 },
    )
  }

  const storagePath = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath)

  if (error || !data) {
    req.payload.logger.error({ err: error, msg: 'Failed to create signed upload URL' })
    return Response.json({ error: 'Could not create upload URL' }, { status: 500 })
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  return Response.json({
    path: data.path,
    publicUrl,
    signedUrl: data.signedUrl,
    token: data.token,
  })
}
