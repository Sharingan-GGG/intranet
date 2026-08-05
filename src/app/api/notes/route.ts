import { type NextRequest, NextResponse } from "next/server"

import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"

// GET /api/notes?pnr=ABC123
export async function GET(req: NextRequest) {
  const pnr = new URL(req.url).searchParams.get("pnr")
  if (!pnr) return NextResponse.json({ error: "pnr required" }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("PNR_Note")
    .select("PNR, Notes, Note_By, Created_at")
    .eq("PNR", pnr.toUpperCase())
    .order("Created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}

// POST /api/notes  { pnr, note }
export async function POST(req: NextRequest) {
  const profile = await getPreDepartureUser()
  if (!profile)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServiceClient()

  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  if (!isAllowed(permissions, "create_note")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json()) as { pnr: string; note: string }
  if (!body.pnr || !body.note) {
    return NextResponse.json(
      { error: "pnr and note required" },
      { status: 400 }
    )
  }

  const noteBy = profile?.full_name ?? profile?.email ?? profile.email ?? profile.id
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("PNR_Note")
    .insert({
      PNR: body.pnr.toUpperCase(),
      Notes: body.note.trim(),
      Note_By: noteBy,
      Created_at: now,
      "Updated at": now,
    })
    .select("PNR, Notes, Note_By, Created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data }, { status: 201 })
}

// DELETE /api/notes?pnr=ABC123&created_at=<iso>
export async function DELETE(req: NextRequest) {
  const profile = await getPreDepartureUser()
  if (!profile)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServiceClient()

  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  if (!isAllowed(permissions, "delete_note")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const pnr = url.searchParams.get("pnr")
  const createdAt = url.searchParams.get("created_at")
  if (!pnr || !createdAt)
    return NextResponse.json(
      { error: "pnr and created_at required" },
      { status: 400 }
    )

  const { error } = await supabase
    .from("PNR_Note")
    .delete()
    .eq("PNR", pnr.toUpperCase())
    .eq("Created_at", createdAt)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
