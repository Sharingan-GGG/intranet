import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"

type DraftBody = {
  pnr: string
  brand: string
}

const N8N_WEBHOOK_URL =
  "https://n8n.srv1421859.hstgr.cloud/webhook/3e94d9e1-cecf-42b3-9a2b-3394687b46c6"

export async function POST(req: NextRequest) {
  const ssrClient = await createSSRClient()
  const {
    data: { user },
  } = await ssrClient.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()

  let body: DraftBody
  try {
    body = (await req.json()) as DraftBody
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const pnr = String(body?.pnr ?? "")
    .trim()
    .toUpperCase()
  const brand = String(body?.brand ?? "").trim()

  if (!pnr || !brand) {
    return NextResponse.json(
      { success: false, error: "pnr and brand are required" },
      { status: 400 }
    )
  }

  // Fetch PNR queue row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: queueRow, error: queueError } = await db
    .from("pnr_queue")
    .select("pnr, consultant_name, added_by, brand")
    .eq("pnr", pnr)
    .eq("brand", brand)
    .single()

  if (queueError || !queueRow) {
    return NextResponse.json(
      { success: false, error: "PNR not found in queue" },
      { status: 404 }
    )
  }

  // Resolve added_by UUID to profile name
  let adminName = queueRow.added_by
  if (queueRow.added_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", queueRow.added_by)
      .single()

    if (profile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adminName = (profile as any).full_name || (profile as any).email || queueRow.added_by
    }
  }

  // POST to n8n webhook
  const webhookPayload = {
    pnr: queueRow.pnr,
    consultantName: queueRow.consultant_name || "",
    adminName: adminName || "",
    BrandSheet: queueRow.brand || "",
  }

  try {
    const webhookRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    })

    if (!webhookRes.ok) {
      const detail = await webhookRes.text().catch(() => "")
      console.error("[draft] Webhook error:", webhookRes.status, detail)
      return NextResponse.json(
        { success: false, error: `Webhook returned ${webhookRes.status}` },
        { status: 500 }
      )
    }

    const webhookData = await webhookRes.json().catch(() => null)
    return NextResponse.json({
      success: true,
      webhook_response: webhookData,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[draft] Webhook call failed:", msg)
    return NextResponse.json(
      { success: false, error: `Webhook call failed: ${msg}` },
      { status: 500 }
    )
  }
}
