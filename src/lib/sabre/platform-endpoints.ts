/**
 * Default Sabre Platform API hosts (production).
 * Override with `SABRE_JSON_BASE_URL` / `SABRE_SOAP_BASE_URL` (legacy: `JSON_STAGING_URL`, `SOAP_STAGING_*`).
 */
export const DEFAULT_SABRE_JSON_BASE_URL = "https://api.platform.sabre.com"

export const DEFAULT_SABRE_SOAP_BASE_URL =
  "https://webservices.platform.sabre.com"

/** JSON base URL from env (primary `SABRE_JSON_BASE_URL`, legacy `JSON_STAGING_URL`). */
export function sabreJsonBaseUrlFromEnv(): string | undefined {
  return (
    process.env.SABRE_JSON_BASE_URL?.trim() ||
    process.env.JSON_STAGING_URL?.trim() ||
    undefined
  )
}

/** SOAP base URL from env (no `/services/soap` suffix). */
export function sabreSoapBaseUrlFromEnv(): string {
  return (
    process.env.SABRE_SOAP_BASE_URL?.trim() ||
    process.env.SOAP_STAGING_URL?.trim() ||
    process.env.SOAP_STAGING_STAGING_URL?.trim() ||
    DEFAULT_SABRE_SOAP_BASE_URL
  )
}

/**
 * If the JSON URL was copied from the SOAP host by mistake, map to the REST API host.
 */
export function normalizeSabreJsonBaseUrl(value?: string | null): string {
  const raw = value?.trim()
  if (!raw) return ""
  return raw
    .replace(
      "webservices.cert.platform.sabre.com",
      "api.cert.platform.sabre.com"
    )
    .replace("webservices.platform.sabre.com", "api.platform.sabre.com")
}

export function resolveSabreJsonBaseUrl(value?: string | null): string {
  const n = normalizeSabreJsonBaseUrl(value ?? sabreJsonBaseUrlFromEnv())
  return n || DEFAULT_SABRE_JSON_BASE_URL
}
