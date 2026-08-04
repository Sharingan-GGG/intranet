export interface SabrePlatformConfig {
  jsonUrl: string
  soapUrl: string
  username: string
  password: string
  pcc: string
}

import { resolveSoapXmlFromEnv } from "@/lib/sabre/env-soap-multiline"
import {
  DEFAULT_SABRE_SOAP_BASE_URL,
  sabreSoapBaseUrlFromEnv,
} from "@/lib/sabre/platform-endpoints"
import { normalizeSabreSoapSessionToken } from "@/lib/sabre/soap-session-token"
import {
  getOrFetchJsonToken,
  getOrFetchSoapToken,
  invalidateJsonToken,
  invalidateSoapToken,
} from "@/lib/sabre/token-store"

export class SabrePlatformAuthError extends Error {
  constructor(message = "Sabre token expired or invalid") {
    super(message)
    this.name = "SabrePlatformAuthError"
  }
}

/**
 * Sabre application-level error surfaced inside
 * `<stl:ApplicationResults status="NotProcessed">` / `<stl:Error>` — these arrive as
 * HTTP 200 with no SOAP `<Fault>`, so they slip past throwIfSoapAuthFault and leave
 * parseP3Soap returning an empty-but-"successful" model. Examples: host NAK,
 * "UPDATED PNR CURRENTLY IN AAA - FINISH OR IGNORE", ERR.SWS.HOST.ERROR_IN_RESPONSE.
 * Surfaced as a scan error so the condition is flagged instead of silently succeeding.
 */
export class SabreHostError extends Error {
  constructor(message = "Sabre host error") {
    super(message)
    this.name = "SabreHostError"
  }
}

/**
 * True when a SOAP call failure should invalidate the cached session and retry with a
 * new SessionCreate. Driven by Sabre fault messages — not by `soap_session_token_expires_at`.
 */
export function isSoapAuthFailureReason(reason: unknown): boolean {
  if (reason instanceof SabrePlatformAuthError) return true
  if (!(reason instanceof Error)) return false
  const m = reason.message
  if (/invalid or expired binary security token/i.test(m)) return true
  if (/SOAP session token expired or invalid/i.test(m)) return true
  if (
    /binary security token/i.test(m) &&
    /invalid|expired|not valid|authenticate|authentication|rejected|denied/i.test(m)
  )
    return true
  if (/wsse:failedauthentication|failedauthentication|securitytoken/i.test(m))
    return true
  return false
}

/**
 * SOAP endpoint base URL (no `/services/soap` suffix).
 * Uses `config.soapUrl`, else `SABRE_SOAP_BASE_URL`, then legacy `SOAP_STAGING_URL` /
 * `SOAP_STAGING_STAGING_URL`, then the platform default.
 */
export function resolveSabreSoapBaseUrl(configSoapUrl?: string): string {
  const fromConfig = configSoapUrl?.trim()
  if (fromConfig) return fromConfig
  return sabreSoapBaseUrlFromEnv() || DEFAULT_SABRE_SOAP_BASE_URL
}

/** TokenCreateRQ envelope: `SABRE_SOAP_TOKEN_CREATE_BODY` or `SOAP_TOKEN_BODY`. */
export function pickSabreTokenCreateXmlFromEnv(): string | undefined {
  return (
    resolveSoapXmlFromEnv("SABRE_SOAP_TOKEN_CREATE_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_TOKEN_BODY")?.trim() ||
    undefined
  )
}

/**
 * SessionCreateRQ envelope: `SABRE_SOAP_SESSION_BODY`, then legacy multiline keys.
 */
export function pickSabreSessionCreateXmlFromEnv(): string | undefined {
  return (
    resolveSoapXmlFromEnv("SABRE_SOAP_SESSION_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_STAGING_SESSION_TOKEN_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_SESSION_TOKEN_BODY")?.trim() ||
    undefined
  )
}

/**
 * Single envelope for legacy callers: session template preferred, else TokenCreate.
 * Prefer {@link fetchSoapToken} which runs TokenCreate → SessionCreate when both are set.
 */
export function pickSabreSoapTokenRequestXmlFromEnv(): string | undefined {
  return (
    pickSabreSessionCreateXmlFromEnv() ?? pickSabreTokenCreateXmlFromEnv()
  )
}

/**
 * Replace session-token placeholders in SOAP templates (P3/P4/SessionClose).
 * Supports `SABRE_SOAP_SESSION_TOKEN` and legacy `SOAP_*_SESSION_TOKEN_BODY` markers.
 */
export function injectSoapSessionTokenInTemplate(
  template: string,
  soapToken: string
): string {
  const t = normalizeSabreSoapSessionToken(soapToken)
  return template
    .replace(/SABRE_SOAP_SESSION_TOKEN/g, t)
    .replace(/SOAP_STAGING_SESSION_TOKEN_BODY/g, t)
    .replace(/SOAP_SESSION_TOKEN_BODY/g, t)
}

/**
 * Replaces inner text of the **first** `BinarySecurityToken` with the live session string.
 * Env templates often paste a sample IceSess; `injectSoapSessionTokenInTemplate` only
 * replaces explicit placeholder markers, so this enforces the current token for P4.
 */
export function injectLiveSoapTokenIntoFirstBinarySecurityToken(
  xml: string,
  soapToken: string
): string {
  const t = normalizeSabreSoapSessionToken(soapToken)
  return xml.replace(
    /(<(?:[\w-]+:)?BinarySecurityToken\b[^>]*>)([\s\S]*?)(<\/(?:[\w-]+:)?BinarySecurityToken>)/i,
    `$1${t}$3`
  )
}

function applySabreSoapCredentialPlaceholders(
  body: string,
  config: SabrePlatformConfig
): string {
  return body
    .replace(/SABRE_SOAP_\s+PCC/g, config.pcc)
    .replace(/SABRE_SOAP_USERNAME/g, config.username)
    .replace(/SABRE_SOAP_PASSWORD/g, config.password)
    .replace(/SABRE_SOAP_PCC/g, config.pcc)
    .replace(/SOAP_STAGING_\s+PCC/g, config.pcc)
    .replace(/SOAP_STAGING_USERNAME/g, config.username)
    .replace(/SOAP_STAGING_PASSWORD/g, config.password)
    .replace(/SOAP_STAGING_PCC/g, config.pcc)
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function extractAllBinarySecurityTokenValues(xml: string): string[] {
  const out: string[] = []
  const re =
    /<(?:[\w-]+:)?BinarySecurityToken\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?BinarySecurityToken>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const raw = (m[1] ?? "").trim()
    if (raw) out.push(raw)
  }
  return out
}

function normalizeSoapTokenText(value: string | undefined): string | null {
  if (value == null) return null
  const t = value.replace(/\s+/g, " ").trim()
  return t || null
}

function extractBinarySecurityTokenFromSoap(xml: string): string | null {
  const tokens = extractAllBinarySecurityTokenValues(xml)
  if (tokens.length === 0) return null
  const ice = tokens.find((t) => /Shared\/IDL:IceSess/i.test(t))
  return ice ?? tokens[tokens.length - 1] ?? null
}

function extractContextIdFromSoap(xml: string): string | null {
  let match = xml.match(
    /<(?:[\w-]+:)?contextId\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?contextId>/i
  )
  if (match) return normalizeSoapTokenText(match[1])
  match = xml.match(/<contextId\b[^>]*>([\s\S]*?)<\/contextId>/i)
  return match ? normalizeSoapTokenText(match[1]) : null
}

function extractSessionSoapTokenFromResponse(xml: string): string | null {
  const bsts = extractAllBinarySecurityTokenValues(xml)
  const ice = bsts.find((t) => /Shared\/IDL:IceSess/i.test(t))
  let raw: string | null = null
  if (ice) {
    raw = ice
  } else if (bsts.length > 0) {
    raw = bsts[bsts.length - 1] ?? null
  } else {
    raw = extractContextIdFromSoap(xml)
  }
  return raw ? normalizeSabreSoapSessionToken(raw) : null
}

function soapActionFromEnvelope(envelope: string, fallback: string): string {
  const eb = envelope.match(/<eb:Action>\s*([^<]+?)\s*<\/eb:Action>/i)
  if (eb?.[1]?.trim()) return eb[1].trim()
  const plain = envelope.match(/<Action>\s*([^<]+?)\s*<\/Action>/i)
  if (plain?.[1]?.trim()) return plain[1].trim()
  return fallback
}

function throwIfSoapFaultResponse(xml: string, label: string): void {
  const faultMatch = xml.match(
    /<(SOAP-ENV:|soap-env:)?Fault[^>]*>[\s\S]*?<\/(?:SOAP-ENV:|soap-env:)?Fault>/i
  )
  if (!faultMatch) return

  const codeMatch = xml.match(
    /<(?:SOAP-ENV:|soap-env:)?faultcode[^>]*>([^<]+)<\/(?:SOAP-ENV:|soap-env:)?faultcode>/i
  )
  const stringMatch = xml.match(
    /<(?:SOAP-ENV:|soap-env:)?faultstring[^>]*>([^<]+)<\/(?:SOAP-ENV:|soap-env:)?faultstring>/i
  )
  const code = codeMatch ? (codeMatch[1] ?? "Unknown") : "Unknown"
  const msg = stringMatch ? (stringMatch[1] ?? "SOAP Fault") : "SOAP Fault"
  throw new Error(`SOAP Fault [${label}] [${code}]: ${msg}`)
}

async function postSoapEnvelope(
  soapUrl: string,
  body: string,
  label: string
): Promise<string> {
  const base = soapUrl.trim().replace(/\/$/, "")
  const res = await fetch(`${base}/services/soap`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
    signal: AbortSignal.timeout(15000),
  })
  const xml = await res.text()
  throwIfSoapFaultResponse(xml, label)
  if (!res.ok) {
    throw new Error(
      `${label} HTTP ${res.status}: ${xml.replace(/\s+/g, " ").slice(0, 240)}`
    )
  }
  return xml
}

export async function fetchJsonToken(
  config: SabrePlatformConfig,
  options: { forceRefresh?: boolean } = {}
): Promise<{ accessToken: string; expiresIn: number }> {
  const token = await getOrFetchJsonToken(async () => {
    const clientId = Buffer.from(
      `V1:${config.username}:${config.pcc}:AA`
    ).toString("base64")
    const clientSecret = Buffer.from(config.password).toString("base64")
    const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    )
    const body = new URLSearchParams({ grant_type: "client_credentials" })

    const res = await fetch(`${config.jsonUrl}/v2/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicToken}`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(
        `JSON token fetch failed: ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ""}`
      )
    }

    const json = (await res.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!json.access_token)
      throw new Error("No access_token in JSON token response")

    return {
      accessToken: json.access_token,
      expiresIn: json.expires_in ?? 3600,
    }
  }, options)

  return { accessToken: token, expiresIn: 3600 }
}

export async function fetchSoapToken(
  config: SabrePlatformConfig,
  options: { forceRefresh?: boolean } = {}
): Promise<string> {
  const token = await getOrFetchSoapToken(async () => {
    const soapUrl = resolveSabreSoapBaseUrl(config.soapUrl)
    const tokenCreateXml = pickSabreTokenCreateXmlFromEnv()
    const sessionCreateXml = pickSabreSessionCreateXmlFromEnv()

    if (tokenCreateXml && sessionCreateXml) {
      const xmlToken = await postSoapEnvelope(
        soapUrl,
        applySabreSoapCredentialPlaceholders(tokenCreateXml, config),
        "TokenCreateRQ"
      )
      const binaryToken = extractBinarySecurityTokenFromSoap(xmlToken)
      if (!binaryToken) {
        throw new Error(
          "TokenCreateRQ: no wsse:BinarySecurityToken in response (required before SessionCreateRQ)"
        )
      }

      let sessionBody = applySabreSoapCredentialPlaceholders(
        sessionCreateXml,
        config
      )
      sessionBody = sessionBody
        .replace(/SABRE_SOAP_TOKEN_CREATE_BINARY/g, binaryToken)
        .replace(/SOAP_STAGING_TOKEN_CREATE_BINARY/g, binaryToken)
        .replace(/SOAP_TOKEN_CREATE_BINARY_SECURITY_TOKEN/g, binaryToken)

      const xmlSession = await postSoapEnvelope(
        soapUrl,
        sessionBody,
        "SessionCreateRQ"
      )
      const sessionToken = extractSessionSoapTokenFromResponse(xmlSession)
      if (!sessionToken) {
        throw new Error(
          "SessionCreateRQ: no session token (BinarySecurityToken / contextId) in response"
        )
      }
      return sessionToken
    }

    if (sessionCreateXml) {
      const xml = await postSoapEnvelope(
        soapUrl,
        applySabreSoapCredentialPlaceholders(sessionCreateXml, config),
        "SessionCreateRQ"
      )
      const sessionToken = extractSessionSoapTokenFromResponse(xml)
      if (!sessionToken) {
        throw new Error(
          "SessionCreateRQ: no session token (BinarySecurityToken / contextId) in response"
        )
      }
      return sessionToken
    }

    if (tokenCreateXml) {
      const xml = await postSoapEnvelope(
        soapUrl,
        applySabreSoapCredentialPlaceholders(tokenCreateXml, config),
        "TokenCreateRQ"
      )
      const t =
        extractBinarySecurityTokenFromSoap(xml) ?? extractContextIdFromSoap(xml)
      if (!t) throw new Error("TokenCreateRQ: no token in SOAP response")
      return t
    }

    const fallback = buildTokenCreateEnvelope(
      config.username,
      config.password,
      config.pcc
    )
    const xml = await postSoapEnvelope(soapUrl, fallback, "TokenCreateRQ")
    const t =
      extractBinarySecurityTokenFromSoap(xml) ?? extractContextIdFromSoap(xml)
    if (!t) throw new Error("TokenCreateRQ: no token in SOAP response")
    return t
  }, options)

  return token
}

export async function fetchJsonPnr(
  pnr: string,
  accessToken: string,
  jsonUrl: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${jsonUrl}/v1/trip/orders/getBooking`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirmationId: pnr }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    if (res.status === 404) throw new Error(`PNR not found: ${pnr}`)
    if (res.status === 401)
      throw new SabrePlatformAuthError("JSON token expired or invalid")
    throw new Error(`GetBooking failed: ${res.status}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  if (hasBookingNotFoundError(json)) throw new Error(`PNR not found: ${pnr}`)
  return json
}

function pickSabreP3RequestBodyFromEnv(): string | undefined {
  return (
    resolveSoapXmlFromEnv("SABRE_SOAP_P3_REQUEST_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_P3_REQUEST_BODY")?.trim() ||
    undefined
  )
}

function pickSabreP4RequestBodyFromEnv(): string | undefined {
  return (
    resolveSoapXmlFromEnv("SABRE_SOAP_P4_REQUEST_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_P4_REQUEST_BODY")?.trim() ||
    undefined
  )
}

function pickSabreSessionCloseBodyFromEnv(): string | undefined {
  return (
    resolveSoapXmlFromEnv("SABRE_SOAP_SESSION_CLOSE_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_SESSION_CLOSE_BODY")?.trim() ||
    undefined
  )
}

export async function fetchSoapP3(
  pnr: string,
  soapToken: string,
  soapUrl: string,
  config?: SabrePlatformConfig
): Promise<string> {
  let soapBody = pickSabreP3RequestBodyFromEnv()

  if (soapBody) {
    soapBody = soapBody.replace(/\{\{\s*pnr\s*\}\}/gi, pnr)
    soapBody = injectSoapSessionTokenInTemplate(soapBody, soapToken)
    if (config) soapBody = applySabreSoapCredentialPlaceholders(soapBody, config)
  } else {
    soapBody = buildP3RequestEnvelope(pnr, soapToken, config?.pcc)
  }

  const soapAction = soapActionFromEnvelope(
    soapBody,
    "TravelItineraryHistoryLLSRQ"
  )
  const base = resolveSabreSoapBaseUrl(soapUrl).replace(/\/$/, "")
  const res = await fetch(`${base}/services/soap`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
    },
    body: soapBody,
    signal: AbortSignal.timeout(15000),
  })

  const xml = await res.text()
  throwIfSoapAuthFault(xml)
  throwIfSoapApplicationError(xml)
  if (!res.ok) {
    const hint = xml.replace(/\s+/g, " ").slice(0, 400)
    throw new Error(
      `P3 SOAP fetch failed: ${res.status}${hint ? ` — ${hint}` : ""}`
    )
  }
  return xml
}

export async function fetchSoapP4(
  ticketNumber: string,
  soapToken: string,
  soapUrl: string,
  config?: SabrePlatformConfig
): Promise<string> {
  const envP4Template = pickSabreP4RequestBodyFromEnv()?.trim()
  let soapBody: string

  if (envP4Template) {
    soapBody = envP4Template
    soapBody = soapBody.replace(/\{\{\s*tkt\s*\}\}/gi, ticketNumber)
    soapBody = injectSoapSessionTokenInTemplate(soapBody, soapToken)
    if (config) soapBody = applySabreSoapCredentialPlaceholders(soapBody, config)
    soapBody = injectLiveSoapTokenIntoFirstBinarySecurityToken(soapBody, soapToken)
  } else {
    soapBody = buildP4RequestEnvelope(ticketNumber, soapToken)
  }

  const soapAction = soapActionFromEnvelope(
    soapBody,
    "GetElectronicDocumentRQ"
  )
  const base = resolveSabreSoapBaseUrl(soapUrl).replace(/\/$/, "")
  const res = await fetch(`${base}/services/soap`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
    },
    body: soapBody,
    signal: AbortSignal.timeout(15000),
  })

  const xml = await res.text()
  throwIfSoapAuthFault(xml)
  throwIfSoapApplicationError(xml)
  if (!res.ok) {
    const hint = xml.replace(/\s+/g, " ").slice(0, 400)
    throw new Error(
      `P4 SOAP fetch failed: ${res.status}${hint ? ` — ${hint}` : ""}`
    )
  }
  return xml
}

export async function refreshJsonToken(): Promise<void> {
  await invalidateJsonToken()
}

export async function refreshSoapToken(): Promise<void> {
  await invalidateSoapToken()
}

/**
 * Sends SessionCloseRQ when a close template exists in env. Callers should usually
 * skip this when reusing `soap_session_token` across HTTP requests — closing ends the
 * Sabre session while Supabase may still hold the IceSess string.
 *
 * @returns true if a close request was sent and HTTP succeeded (caller may invalidate cache).
 */
export async function fetchSoapSessionClose(
  soapToken: string,
  soapUrl: string,
  config?: SabrePlatformConfig
): Promise<boolean> {
  let body = pickSabreSessionCloseBodyFromEnv()
  if (!body) return false

  body = injectSoapSessionTokenInTemplate(body, soapToken)
  if (config) body = applySabreSoapCredentialPlaceholders(body, config)

  const base = resolveSabreSoapBaseUrl(soapUrl).replace(/\/$/, "")
  const res = await fetch(`${base}/services/soap`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.warn(
      `[SABRE] SessionCloseRQ failed: ${res.status} ${detail.slice(0, 240)}`
    )
    return false
  }
  return true
}

function buildTokenCreateEnvelope(
  username: string,
  password: string,
  pcc: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header>
    <MessageHeader xmlns="http://www.ebxml.org/namespaces/messageHeader">
      <From><PartyId>Agency</PartyId></From>
      <To><PartyId>Sabre_API</PartyId></To>
      <ConversationId>2021.01.DevStudio</ConversationId>
      <Action>TokenCreateRQ</Action>
    </MessageHeader>
    <Security xmlns="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <UsernameToken>
        <Username>${username}</Username>
        <Password>${password}</Password>
        <Organization>${pcc}</Organization>
        <Domain>DEFAULT</Domain>
      </UsernameToken>
    </Security>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <TokenCreateRQ Version="1.0.0" xmlns="http://webservices.sabre.com"/>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`
}

function buildP3RequestEnvelope(
  pnr: string,
  soapToken: string,
  pcc?: string
): string {
  const pccTrimmed = pcc?.trim()
  const cpa = pccTrimmed
    ? `<eb:CPAId>${escapeXmlText(pccTrimmed)}</eb:CPAId>
      <eb:Service eb:type="sabreXML">SabreXML</eb:Service>`
    : ""
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Header>
    <eb:MessageHeader xmlns:eb="http://www.ebxml.org/namespaces/messageHeader" eb:version="1.0" SOAP-ENV:mustUnderstand="1"
      xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
      <eb:From><eb:PartyId/></eb:From>
      <eb:To><eb:PartyId/></eb:To>
      ${cpa}
      <eb:Action>TravelItineraryHistoryLLSRQ</eb:Action>
      <eb:ConversationId>${Date.now()}</eb:ConversationId>
    </eb:MessageHeader>
    <wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wsse:BinarySecurityToken>${escapeXmlText(soapToken)}</wsse:BinarySecurityToken>
    </wsse:Security>
  </soap-env:Header>
  <soap-env:Body>
    <TravelItineraryHistoryRQ ReturnHostCommand="true" Version="2.3.0" xmlns="http://webservices.sabre.com/sabreXML/2011/10">
      <UniqueID ID="${escapeXmlText(pnr)}"/>
    </TravelItineraryHistoryRQ>
  </soap-env:Body>
</soap-env:Envelope>`
}

/**
 * Default P4 envelope when no `SOAP_P4_REQUEST_BODY` env template is set.
 * Matches legacy staging-client shape: SWS/Agency message header,
 * `TKT_ElectronicDocumentServicesRQ`, eDoc GetElectronicDocumentRQ body with DocumentNumber.
 */
function buildP4RequestEnvelope(ticketNumber: string, soapToken: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Header>
    <eb:MessageHeader xmlns:eb="http://www.ebxml.org/namespaces/messageHeader" eb:version="1.0" soap-env:mustUnderstand="1">
      <eb:From><eb:PartyId eb:type="URI">SWS</eb:PartyId></eb:From>
      <eb:To><eb:PartyId eb:type="URI">Agency</eb:PartyId></eb:To>
      <eb:ConversationId>2021.01.DevStudio</eb:ConversationId>
      <eb:Action>TKT_ElectronicDocumentServicesRQ</eb:Action>
    </eb:MessageHeader>
    <wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wsse:BinarySecurityToken valueType="String" EncodingType="wsse:Base64Binary">${escapeXmlText(soapToken)}</wsse:BinarySecurityToken>
    </wsse:Security>
  </soap-env:Header>
  <soap-env:Body>
    <GetElectronicDocumentRQ Version="2.2.0" xmlns="http://www.sabre.com/ns/Ticketing/EDoc" xmlns:STL="http://www.sabre.com/ns/Ticketing/EDocStl">
      <STL:STL_Header.RQ/>
      <STL:POS/>
      <SearchParameters>
        <DocumentNumber>${escapeXmlText(ticketNumber)}</DocumentNumber>
      </SearchParameters>
    </GetElectronicDocumentRQ>
  </soap-env:Body>
</soap-env:Envelope>`
}

function throwIfSoapAuthFault(xml: string): void {
  const faultMatch = xml.match(
    /<(?:[\w-]+:)?Fault\b[\s\S]*?<\/(?:[\w-]+:)?Fault>/i
  )
  if (faultMatch) {
    const faultText = faultMatch[0]
    if (
      /token|session|binary|security|auth|credential|expired|invalid/i.test(
        faultText
      )
    ) {
      const stringMatch = faultText.match(
        /<(?:[\w-]+:)?faultstring[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?faultstring>/i
      )
      const msg = stringMatch?.[1]?.replace(/\s+/g, " ").trim()
      throw new SabrePlatformAuthError(
        msg || "SOAP session token expired or invalid"
      )
    }
  }

  if (/Invalid or Expired binary security token/i.test(xml)) {
    const oneLine = xml.replace(/\s+/g, " ").trim()
    const m = oneLine.match(
      /Invalid or Expired binary security token[^<]{0,400}/i
    )
    throw new SabrePlatformAuthError(
      m?.[0]?.trim() ?? "Invalid or Expired binary security token"
    )
  }
}

/**
 * Detect Sabre application-level errors (HTTP 200, no SOAP Fault) carried in
 * `<stl:ApplicationResults status="NotProcessed"|"Failed">` with an `<stl:Error>` element,
 * e.g. `NAK3 - UPDATED PNR CURRENTLY IN AAA - FINISH OR IGNORE`,
 * `ERR.SWS.HOST.ERROR_IN_RESPONSE`. Without this the scan looks "successful" but empty.
 * Throws SabreHostError so the scan fails loudly (flagged) instead of silently succeeding.
 */
function throwIfSoapApplicationError(xml: string): void {
  if (
    !/ApplicationResults\b[^>]*status=["'](?:NotProcessed|Failed)["']/i.test(xml)
  )
    return
  const errMatch = xml.match(/<(?:[\w-]+:)?Error\b[\s\S]*?<\/(?:[\w-]+:)?Error>/i)
  if (!errMatch) return
  const errText = errMatch[0]
  const pick = (tag: string) =>
    errText
      .match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "i"))?.[1]
      ?.replace(/\s+/g, " ")
      .trim()
  const message =
    [pick("Message"), pick("ShortText")].filter(Boolean).join(" — ") ||
    "Sabre host error (ApplicationResults NotProcessed)"
  throw new SabreHostError(message)
}

function hasBookingNotFoundError(json: Record<string, unknown>): boolean {
  const errors = json.errors
  if (!Array.isArray(errors)) return false
  return errors.some((error) => {
    if (typeof error !== "object" || error === null) return false
    const row = error as Record<string, unknown>
    return [row.category, row.type, row.description].some(
      (value) =>
        typeof value === "string" && /not[_ ]found|cannot be found/i.test(value)
    )
  })
}

/** SOAP credentials from env (`SABRE_SOAP_*`, legacy `SOAP_STAGING_*`). */
export function sabreSoapCredentialsFromEnv(): {
  username: string
  password: string
  pcc: string
} {
  return {
    username:
      process.env.SABRE_SOAP_USERNAME?.trim() ||
      process.env.SOAP_STAGING_USERNAME?.trim() ||
      "",
    password:
      process.env.SABRE_SOAP_PASSWORD?.trim() ||
      process.env.SOAP_STAGING_PASSWORD?.trim() ||
      "",
    pcc:
      process.env.SABRE_SOAP_PCC?.trim() ||
      process.env.SOAP_STAGING_PCC?.trim() ||
      "",
  }
}
