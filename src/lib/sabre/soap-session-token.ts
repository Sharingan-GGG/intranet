/**
 * Light cleanup for values parsed from `<wsse:BinarySecurityToken>` text nodes.
 *
 * Sabre **IceSess** session strings are opaque: they may contain literal backslashes
 * before `/` and `.` (e.g. `IceSess\/SessMgr`, `1\.0`). Do **not** unescape `\/` or
 * strip those characters — Sabre compares the exact string.
 *
 * Only trims surrounding XML whitespace and optional wrapping quotes from storage.
 */
export function normalizeSabreSoapSessionToken(token: string): string {
  let t = token.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim()
  }
  return t
}

/**
 * How far ahead we set `soap_session_token_expires_at` when persisting. This is for
 * housekeeping / status UI only — we reuse the cached SOAP token until Sabre rejects it
 * or `invalidateSoapToken` runs, not until this timestamp.
 *
 * Override with `SABRE_SOAP_SESSION_STORED_EXPIRY_SECONDS`, or legacy
 * `SABRE_SOAP_SESSION_CACHE_TTL_SECONDS` / `SOAP_SESSION_CACHE_TTL_SECONDS` (3600–2592000).
 */
export function soapSessionStoredExpirySeconds(): number {
  const raw =
    process.env.SABRE_SOAP_SESSION_STORED_EXPIRY_SECONDS?.trim() ||
    process.env.SABRE_SOAP_SESSION_CACHE_TTL_SECONDS?.trim() ||
    process.env.SOAP_SESSION_CACHE_TTL_SECONDS?.trim()
  if (raw) {
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 3600 && n <= 30 * 24 * 3600) return n
  }
  return 7 * 24 * 60 * 60
}

/**
 * When true, skip reading `soap_session_token` from Supabase and always create a new
 * SOAP session. Default is false (reuse cached token when present).
 *
 * Set `SABRE_SOAP_SESSION_DISABLE_CACHE=1` (or `true` / `yes`), or legacy
 * `SABRE_SOAP_SESSION_CACHE=0` / `false` / `no`.
 */
export function soapSessionSupabaseCacheDisabled(): boolean {
  const disable = process.env.SABRE_SOAP_SESSION_DISABLE_CACHE?.trim().toLowerCase()
  if (disable === "1" || disable === "true" || disable === "yes") return true
  const legacy = process.env.SABRE_SOAP_SESSION_CACHE?.trim().toLowerCase()
  if (legacy === "0" || legacy === "false" || legacy === "no") return true
  return false
}

/**
 * When true, `pnr-fetch` calls SessionClose after P3/P4. That ends the Sabre SOAP
 * session server-side — the cached IceSess in Supabase would then be stale and the
 * next fetch would be forced to create a new session. Default is false so the same
 * session can be reused across requests.
 *
 * Set `SABRE_SOAP_SESSION_CLOSE_ON_DONE=1` (or `true` / `yes`) only if you explicitly
 * want to close after each scan (still requires a SessionClose SOAP body from env;
 * see `fetchSoapSessionClose` in `lib/sabre/platform-client.ts`).
 */
export function sabreSoapSessionCloseOnDoneEnabled(): boolean {
  const v = process.env.SABRE_SOAP_SESSION_CLOSE_ON_DONE?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}
