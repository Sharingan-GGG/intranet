import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../access/anyone'
import { hasAdminCollectionAccess } from '../access/departmentPermissions'
import { presignMediaUpload } from './Media/presignUpload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    create: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'media'),
    delete: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'media'),
    read: anyone,
    update: ({ req }) => hasAdminCollectionAccess(req.payload, req.user, 'media'),
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (req.file && req.file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`)
        }
        if (operation !== 'create') return data
        // A file came through Payload's normal multipart upload — fine.
        if (req.file) return data
        // No file: this must be a direct-to-Supabase upload supplying its own metadata.
        if (data?.filename && data?.url && data?.mimeType && data?.filesize) {
          if (data.filesize > MAX_UPLOAD_BYTES) {
            throw new Error(`File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`)
          }
          return data
        }
        throw new Error('Media requires a file, or filename/url/mimeType/filesize from a direct upload.')
      },
    ],
  },
  endpoints: [
    {
      handler: presignMediaUpload,
      method: 'post',
      path: '/presign',
    },
  ],
  fields: [
    {
      name: 'directUpload',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/MediaDirectUpload',
        },
      },
    },
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    mimeTypes: ['image/*', 'video/*'],
    // Files uploaded directly to Supabase Storage (see Media/presignUpload.ts) skip Payload's
    // own file requirement — the Vercel serverless body limit (~4.5MB) makes videos too big to
    // route through the normal multipart upload handler.
    filesRequiredOnCreate: false,
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}
