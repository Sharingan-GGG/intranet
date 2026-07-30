import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"

const SELECT = "id, PNR, Status, reason, reported_by, reported_on, created_at"

// GET /api/report-it?pnr=ABC123
// Returns { flag: current active (non-Done) record | null, history: all records }
export async function GET(req: NextRequest) {
  const pnr = new URL(req.url).searchParams.get("pnr")
  if (!pnr) return NextResponse.json({ error: "pnr required" }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("PNR_Report_IT")
    .select(SELECT)
    .eq("PNR", pnr.toUpperCase())
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const history = data ?? []
  const flag = history.find((r) => r.Status !== "Done") ?? null
  return NextResponse.json({ flag, history })
}

// POST /api/report-it  { pnr, reason? }  — creates Status=Reported
export async function POST(req: NextRequest) {
  const ssrClient = await createSSRClient()
  const {
    data: { user },
  } = await ssrClient.auth.getUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as { pnr: string; reason?: string }
  if (!body.pnr) {
    return NextResponse.json({ error: "pnr required" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("auth_id", user.id)
    .single()

  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  if (!isAllowed(permissions, "create_report_it")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const reportedBy =
    profile?.full_name ?? profile?.email ?? user.email ?? user.id

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("PNR_Report_IT")
    .insert({
      PNR: body.pnr.toUpperCase(),
      Status: "Reported",
      reason: body.reason?.trim() ?? null,
      reported_by: reportedBy,
      reported_on: now,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flag: data }, { status: 201 })
}

// PATCH /api/report-it  { id, status }  — admin/super_admin status transitions
export async function PATCH(req: NextRequest) {
  const ssrClient = await createSSRClient()
  const {
    data: { user },
  } = await ssrClient.auth.getUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .single()

  if (profile?.role === "user") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json()) as { id: number; status: string }
  if (!body.id || !body.status) {
    return NextResponse.json(
      { error: "id and status required" },
      { status: 400 }
    )
  }

  const allowed = ["Reported", "Pending", "Done"]
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${allowed.join(", ")}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("PNR_Report_IT")
    .update({ Status: body.status })
    .eq("id", body.id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flag: data })
}
