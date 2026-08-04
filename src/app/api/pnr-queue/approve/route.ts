import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"

type ApproveBody = {
  pnr: string
  brand: string
}

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
  // The generated Supabase types might not yet include the newly allowed queue_status values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_id", user.id)
    .single()

  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  const canApprove = isAllowed(permissions, "move_pnr")
  if (!canApprove) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    )
  }

  let body: ApproveBody
  try {
    body = (await req.json()) as ApproveBody
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

  const nowIso = new Date().toISOString()

  const { data: updatedRows, error: updateError } = await db
    .from("pnr_queue")
    .update({ queue_status: "pending", processed_at: nowIso })
    .eq("pnr", pnr)
    .eq("brand", brand)
    .eq("queue_status", "exception")
    .select("id, pnr, brand, sheet_row")

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    )
  }

  const updatedCount = updatedRows?.length ?? 0

  if (updatedCount > 0) {
    // Write audit trail
    await db.from("pnr_audit_log").insert({
      pnr,
      brand,
      action: "moved",
      performed_by: profile?.id ?? null,
      meta: { from: "exception", to: "pending", action: "approve", at: nowIso },
    })
  }

  return NextResponse.json({ success: true, updated: updatedCount })
}
