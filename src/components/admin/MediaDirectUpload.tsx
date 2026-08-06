'use client'

import { toast, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const BUCKET = 'media'

/**
 * Alternative to Payload's built-in file field for the Media collection: uploads straight to
 * Supabase Storage from the browser via a signed URL, bypassing the server entirely. Needed
 * because Vercel's serverless functions cap request bodies around 4.5MB, which the normal
 * multipart upload (through Payload) can't exceed — this is the only path that supports video.
 */
export default function MediaDirectUpload() {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Only relevant when creating a new doc — editing an existing one already has a file.
  if (id) return null

  const handleFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`)
      return
    }

    setUploading(true)
    try {
      const presignRes = await fetch('/api/media/presign', {
        body: JSON.stringify({ filename: file.name, fileSize: file.size, mimeType: file.type }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!presignRes.ok) {
        const { error } = await presignRes.json().catch(() => ({ error: undefined }))
        throw new Error(error || 'Could not start upload')
      }
      const { path, publicUrl, token } = await presignRes.json()

      const { error: uploadError } = await createClient()
        .storage.from(BUCKET)
        .uploadToSignedUrl(path, token, file)
      if (uploadError) throw uploadError

      const createRes = await fetch('/api/media', {
        body: JSON.stringify({
          filename: file.name,
          filesize: file.size,
          mimeType: file.type,
          url: publicUrl,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!createRes.ok) {
        const { errors } = await createRes.json().catch(() => ({ errors: undefined }))
        throw new Error(errors?.[0]?.message || 'Could not create media document')
      }
      const { doc } = await createRes.json()

      toast.success('Upload complete')
      router.push(`/admin/collections/media/${doc.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      style={{
        alignItems: 'center',
        border: '1px dashed var(--theme-elevation-250)',
        borderRadius: 6,
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        padding: '12px 16px',
      }}
    >
      <span style={{ color: 'var(--theme-elevation-600)', fontSize: 13 }}>
        Uploading a video? Use direct upload (up to 20MB) instead of the field below.
      </span>
      <input
        accept="image/*,video/*"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
        ref={inputRef}
        style={{ fontSize: 13 }}
        type="file"
      />
      {uploading && <span style={{ fontSize: 13 }}>Uploading…</span>}
    </div>
  )
}
