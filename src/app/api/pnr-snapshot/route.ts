import { type NextRequest, NextResponse } from "next/server"

import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * GET /api/pnr-snapshot?pnr=ABC123&brand=SABRE
 * Returns latest Supabase snapshot (pnr_history + pnr_json / pnr_p3 / pnr_ticket).
 * Optional brand filters by brands.code via pnr_history.brand_id.
 */
export async function GET(req: NextRequest) {
  const profile = await getPreDepartureUser()
  if (!profile)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pnr = new URL(req.url).searchParams.get("pnr")?.trim().toUpperCase()
  const brand = new URL(req.url).searchParams.get("brand")?.trim() ?? ""

  if (!pnr || !/^[A-Z0-9]{6}$/.test(pnr)) {
    return NextResponse.json({ error: "Invalid or missing pnr" }, { status: 400 })
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pnr_* tables not in generated Database type yet
  const db: any = supabase

  let historyQuery = db
    .from("pnr_history")
    .select("id, processed_at, brand_id")
    .eq("pnr", pnr)

  if (brand) {
    const { data: brandRow, error: brandErr } = await db
      .from("brands")
      .select("id")
      .eq("code", brand)
      .maybeSingle()
    if (brandErr)
      return NextResponse.json({ error: brandErr.message }, { status: 500 })
    if (brandRow?.id != null) {
      historyQuery = historyQuery.eq("brand_id", brandRow.id)
    }
  }

  const { data: hist, error: histErr } = await historyQuery.maybeSingle()

  if (histErr)
    return NextResponse.json({ error: histErr.message }, { status: 500 })
  if (!hist?.id) {
    // No stored snapshot. Only worth a live Sabre fetch if the PNR is still
    // queued — otherwise it was deleted (or never queued) and re-fetching
    // would resurrect it.
    const { data: queueRow } = await db
      .from("pnr_queue")
      .select("pnr")
      .eq("pnr", pnr)
      .maybeSingle()

    return NextResponse.json({
      found: false,
      pnr,
      brand_filter: brand || null,
      in_queue: !!queueRow,
    })
  }

  let brandCode: string | null = null
  if (hist.brand_id != null) {
    const { data: b } = await db
      .from("brands")
      .select("code")
      .eq("id", hist.brand_id)
      .maybeSingle()
    brandCode = b?.code ?? null
  }

  const hid = hist.id as number

  const [jsonRes, p3Res, ticketRes] = await Promise.all([
    db.from("pnr_json").select("data").eq("pnr_history_id", hid).maybeSingle(),
    db.from("pnr_p3").select("soap_xml").eq("pnr_history_id", hid).maybeSingle(),
    db.from("pnr_ticket").select("soap_xml").eq("pnr_history_id", hid).maybeSingle(),
  ])

  const jsonErr = jsonRes.error?.message
  const p3Err = p3Res.error?.message
  const ticketErr = ticketRes.error?.message
  if (jsonErr || p3Err || ticketErr) {
    return NextResponse.json(
      {
        error: jsonErr ?? p3Err ?? ticketErr ?? "snapshot read failed",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    found: true,
    pnr,
    brand_code: brandCode,
    brand_filter: brand || null,
    history_id: hid,
    processed_at: hist.processed_at ?? null,
    pnr_json: jsonRes.data?.data ?? null,
    pnr_p3_soap: p3Res.data?.soap_xml ?? null,
    /** P4 electronic document SOAP; table name is pnr_ticket */
    pnr_p4_soap: ticketRes.data?.soap_xml ?? null,
  })
}
