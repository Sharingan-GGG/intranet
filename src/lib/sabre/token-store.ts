import { createHash } from "node:crypto"

import { createClient } from "@supabase/supabase-js"
import {
  normalizeSabreSoapSessionToken,
  soapSessionStoredExpirySeconds,
  soapSessionSupabaseCacheDisabled,
} from "@/lib/sabre/soap-session-token"
import type { Database } from "@/lib/supabase/database.types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase env vars for token store")
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

const TOKEN_ID = "sabre_platform"

type TokenRow = {
  json_token?: string | null
  json_token_expires_at?: string | null
  soap_session_token?: string | null
  soap_session_token_expires_at?: string | null
  updated_at?: string | null
}

function expiresAtFromSeconds(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 3600
  return new Date(Date.now() + safeSeconds * 1000).toISOString()
}

function parseSupabaseTimestamp(value: string): number {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  return new Date(normalized).getTime()
}

function looksLikeSoapSessionToken(token: string): boolean {
  return /Shared\/IDL:IceSess/i.test(token)
}

function isUniqueViolation(err: {
  code?: string
  message?: string
}): boolean {
  return (
    err.code === "23505" ||
    /duplicate key|unique constraint/i.test(err.message ?? "")
  )
}

/** Updates only the given columns so JSON and SOAP caches never wipe each other. */
async function persistSabreTokenPartial(
  patch: Pick<
    Database["public"]["Tables"]["sabre_tokens"]["Update"],
    | "json_token"
    | "json_token_expires_at"
    | "soap_session_token"
    | "soap_session_token_expires_at"
  >
): Promise<void> {
  const updated_at = new Date().toISOString()
  const updatePayload = { ...patch, updated_at }

  const { data: updatedRows, error: upErr } = await supabase
    .from("sabre_tokens")
    .update(updatePayload)
    .eq("id", TOKEN_ID)
    .select("id")

  if (upErr) {
    throw new Error(`Failed to update sabre_tokens: ${upErr.message}`)
  }
  if (updatedRows && updatedRows.length > 0) {
    return
  }

  const insertPayload: Database["public"]["Tables"]["sabre_tokens"]["Insert"] =
    {
      id: TOKEN_ID,
      ...patch,
      updated_at,
    }

  const { error: insErr } = await supabase
    .from("sabre_tokens")
    .insert(insertPayload)

  if (!insErr) {
    return
  }
  if (!isUniqueViolation(insErr)) {
    throw new Error(`Failed to insert sabre_tokens: ${insErr.message}`)
  }

  const { error: retryErr } = await supabase
    .from("sabre_tokens")
    .update(updatePayload)
    .eq("id", TOKEN_ID)

  if (retryErr) {
    throw new Error(
      `Failed to patch sabre_tokens after race: ${retryErr.message}`
    )
  }
}

/**
 * Reuses `json_token` from Supabase whenever present (unless `forceRefresh`).
 * `json_token_expires_at` is stored for observability only — refresh after a JSON API
 * call returns `SabrePlatformAuthError` (see `invalidateJsonToken` + `forceRefresh`).
 */
export async function getOrFetchJsonToken(
  fetchFn: () => Promise<{ accessToken: string; expiresIn: number }>,
  options: { forceRefresh?: boolean } = {}
): Promise<string> {
  let data: TokenRow | null = null
  if (!options.forceRefresh) {
    const result = await supabase
      .from("sabre_tokens")
      .select("json_token")
      .eq("id", TOKEN_ID)
      .maybeSingle()
    data = result.data
  }

  if (
    !options.forceRefresh &&
    data?.json_token &&
    !looksLikeSoapSessionToken(data.json_token)
  ) {
    return data.json_token
  }

  const result = await fetchFn()

  await persistSabreTokenPartial({
    json_token: result.accessToken,
    json_token_expires_at: expiresAtFromSeconds(result.expiresIn),
  })

  return result.accessToken
}

/**
 * Reuses `soap_session_token` when present (unless `forceRefresh` or cache disabled).
 * `soap_session_token_expires_at` is stored for observability only — refresh after SOAP
 * faults (see `invalidateSoapToken` + `forceRefresh`).
 */
export async function getOrFetchSoapToken(
  fetchFn: () => Promise<string>,
  options: { forceRefresh?: boolean } = {}
): Promise<string> {
  let data: TokenRow | null = null
  if (!options.forceRefresh && !soapSessionSupabaseCacheDisabled()) {
    const { data: row, error } = await supabase
      .from("sabre_tokens")
      .select("soap_session_token")
      .eq("id", TOKEN_ID)
      .maybeSingle()
    if (error) {
      console.warn(
        `[SABRE] sabre_tokens soap read failed (will create new session): ${error.message}`
      )
    } else {
      data = row
    }
  }

  if (!options.forceRefresh && !soapSessionSupabaseCacheDisabled()) {
    const cached = data?.soap_session_token
      ? normalizeSabreSoapSessionToken(data.soap_session_token)
      : ""
    if (cached) return cached
  }

  const token = normalizeSabreSoapSessionToken(await fetchFn())

  await persistSabreTokenPartial({
    soap_session_token: token,
    soap_session_token_expires_at: expiresAtFromSeconds(
      soapSessionStoredExpirySeconds()
    ),
  })

  return token
}

export async function invalidateJsonToken(): Promise<void> {
  await supabase
    .from("sabre_tokens")
    .update({
      json_token: null,
      json_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", TOKEN_ID)
}

export async function invalidateSoapToken(): Promise<void> {
  await supabase
    .from("sabre_tokens")
    .update({
      soap_session_token: null,
      soap_session_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", TOKEN_ID)
}

/** Read-only snapshot for debugging cache reuse (no token bytes returned). */
export async function getSabreTokenCacheProbe() {
  const { data, error } = await supabase
    .from("sabre_tokens")
    .select("soap_session_token, json_token, updated_at")
    .eq("id", TOKEN_ID)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: error.message }
  }

  const soapNorm = data?.soap_session_token
    ? normalizeSabreSoapSessionToken(data.soap_session_token)
    : ""

  return {
    ok: true as const,
    rowPresent: !!data,
    soapNormalizedLength: soapNorm.length,
    soapFingerprintSha256_12: soapNorm
      ? createHash("sha256").update(soapNorm, "utf8").digest("hex").slice(0, 12)
      : null,
    jsonTokenPresent: !!data?.json_token,
    updated_at: data?.updated_at ?? null,
  }
}

export async function getTokenStatus() {
  const { data, error } = await supabase
    .from("sabre_tokens")
    .select("*")
    .eq("id", TOKEN_ID)
    .maybeSingle()

  if (error || !data) {
    return {
      json_token_valid: false,
      json_token_age_ms: null,
      soap_token_valid: false,
      soap_token_age_ms: null,
    }
  }

  const now = Date.now()

  return {
    /** Bearer present (reuse until GetBooking returns 401 / `SabrePlatformAuthError`). */
    json_token_valid:
      !!data.json_token && !looksLikeSoapSessionToken(data.json_token),
    json_token_age_ms: data.updated_at
      ? now - parseSupabaseTimestamp(data.updated_at)
      : null,
    /** IceSess present (reuse until SOAP auth fault / `invalidateSoapToken`). */
    soap_token_valid: !!normalizeSabreSoapSessionToken(
      data.soap_session_token ?? ""
    ),
    soap_token_age_ms: data.updated_at
      ? now - parseSupabaseTimestamp(data.updated_at)
      : null,
  }
}
