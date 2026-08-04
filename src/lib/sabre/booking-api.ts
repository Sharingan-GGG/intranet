import { SabreAuthError } from "./session"

export type RawBookingJson = Record<string, unknown>

export async function getBookingJson(
  pnr: string,
  token: string
): Promise<RawBookingJson> {
  const base = process.env.SABRE_REST_BASE_URL!.replace(/\/$/, "")
  const url = `${base}/v1/trip/orders/getBooking?confirmationId=${encodeURIComponent(pnr)}`

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (resp.status === 401) throw new SabreAuthError()
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "")
    throw new Error(`Sabre booking API ${resp.status}: ${detail.slice(0, 200)}`)
  }

  return resp.json() as Promise<RawBookingJson>
}
