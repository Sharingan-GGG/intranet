import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BASE = "http://localhost/pre"

function getLegacyBaseUrl(): string {
  return process.env.LEGACY_PRE_BASE_URL?.replace(/\/$/, "") || DEFAULT_BASE
}

/**
 * POST { pnr, brand? }
 * Fans out PNR_JSON + PNR_TICKET + PNR_P3 in parallel server-side,
 * returning all three payloads in a single response.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { pnr?: string; brand?: string }
  const pnr = String(body.pnr ?? "").trim()
  if (!pnr) {
    return NextResponse.json({ error: "pnr required" }, { status: 400 })
  }

  const base = getLegacyBaseUrl()
  const phpUrl = `${base}/fetchDatabase.php`
  const brand = body.brand ?? ""
  const headers = { "Content-Type": "application/json" }

  try {
    const [jRes, tRes, p3Res] = await Promise.all([
      fetch(phpUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ table: "PNR_JSON", pnr, brand }),
        cache: "no-store",
      }),
      fetch(phpUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ table: "PNR_TICKET", pnr }),
        cache: "no-store",
      }),
      fetch(phpUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ table: "PNR_P3", pnr, brand }),
        cache: "no-store",
      }),
    ])

    const [jsonText, ticketText, p3Text] = await Promise.all([
      jRes.text(),
      tRes.text(),
      p3Res.text(),
    ])

    return NextResponse.json({
      json: jsonText,
      jsonOk: jRes.ok,
      ticket: ticketText,
      ticketOk: tRes.ok,
      p3: p3Text,
      p3Ok: p3Res.ok,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
