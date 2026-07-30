import { createServiceClient } from "@/lib/supabase/server"

export class SabreAuthError extends Error {
  constructor() {
    super("Sabre token expired or invalid")
    this.name = "SabreAuthError"
  }
}

/**
 * Production Sabre OAuth token for scan-brand.
 * Stored in sabre_oauth_tokens — not sabre_tokens (Sabre Platform JSON + SOAP cache).
 */
export async function getToken(forceRefresh = false): Promise<string> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  if (!forceRefresh) {
    const { data } = await db
      .from("sabre_oauth_tokens")
      .select("token, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.token) return data.token as string
  }

  const resp = await fetch(process.env.SABRE_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SABRE_CLIENT_ID!,
      client_secret: process.env.SABRE_CLIENT_SECRET!,
    }),
    cache: "no-store",
  })

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "")
    throw new Error(
      `Sabre token refresh failed ${resp.status}: ${detail.slice(0, 200)}`
    )
  }

  const json = await resp.json()
  const token: string = json.access_token
  const expiresIn: number = json.expires_in ?? 3600
  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString()

  await db.from("sabre_oauth_tokens").delete().neq("id", 0)
  await db.from("sabre_oauth_tokens").insert({ token, expires_at: expiresAt })

  return token
}
