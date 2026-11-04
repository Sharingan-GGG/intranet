import { NextResponse } from 'next/server'

import { auditQuery } from '@/lib/audit-db'
import { urlBelongsTo } from '@/lib/audit-wp'

import { withWpConnection } from '../_shared'

/**
 * The plugin's "Test connection" (and its first call after a key is saved).
 *
 * Records the plugin's webhook endpoint so the status trigger knows where to
 * POST, and hands back the webhook secret — the site proves who it is with its
 * key, so nobody has to copy the second secret by hand, and rotating the key
 * (scripts/audit-wp-key.mjs) rotates both on the next connect.
 *
 * The endpoint must be on the site's own domain: the database will POST to it,
 * so it cannot be allowed to point anywhere else.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  return withWpConnection(req, async (conn, body) => {
    const { webhookUrl, pluginVersion } = body
    if (webhookUrl !== undefined) {
      if (!urlBelongsTo(webhookUrl, conn.domain) || !webhookUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: `webhookUrl must be an https URL on ${conn.domain}.` },
          { status: 400 },
        )
      }
    }
    await auditQuery(
      `update audit.wp_connections
          set webhook_url = coalesce($2, webhook_url),
              plugin_version = coalesce($3, plugin_version)
        where domain = $1`,
      [
        conn.domain,
        typeof webhookUrl === 'string' ? webhookUrl : null,
        typeof pluginVersion === 'string' ? pluginVersion.slice(0, 32) : null,
      ],
    )
    return NextResponse.json({
      ok: true,
      domain: conn.domain,
      site: conn.site.label,
      webhookSecret: conn.webhookSecret,
    })
  })
}
