/**
 * Pre Departure dashboard data loader.
 *
 * Merges the legacy MySQL bridge (`fetchDatabase.php`) with the Supabase `pnr_queue`
 * workflow into one row per PNR, and applies the caller's visibility scope.
 *
 * Lives here rather than in the route handler so the server component can render the
 * first paint from the same code the client's refetches hit, with no HTTP hop and no
 * risk of the two drifting apart.
 */

import type { DashboardPnrItem, LegacyPnrHistoryRow } from "@/lib/pnr-types"
import { createServiceClient } from "@/lib/supabase/server"
import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { findDirectoryEntries } from "@/lib/pre-departure-directory"

const DEFAULT_BASE = "http://localhost/pre"

/**
 * Cap on the legacy bridge fetch. This call is on the server render path for
 * /pre-departure, so an unbounded wait would hang the page itself. On timeout the
 * loader degrades to the Supabase queue, which is the same path a bridge outage
 * already takes.
 */
const LEGACY_TIMEOUT_MS = 10_000

function getLegacyBaseUrl(): string {
  return process.env.LEGACY_PRE_BASE_URL?.replace(/\/$/, "") || DEFAULT_BASE
}

export function normalizeDashboardRow(
  row: LegacyPnrHistoryRow
): DashboardPnrItem {
  const st = (row.Status ?? "").toLowerCase()
  const total: "exception" | "pending" =
    st === "exception" ? "exception" : "pending"
  const placeholder = {
    flight: st === "exception" ? ("exception" as const) : ("pending" as const),
    p3: "pending" as const,
    ticket: "pending" as const,
    messages: "pending" as const,
    total,
  }
  return {
    pnr: String(row.PNR ?? ""),
    client: String(row.Profile_Name ?? ""),
    consultant: String(row.Consultant_Name ?? ""),
    source: String(row.Source_Type ?? ""),
    frequentFlyer: String(row.Frequent_Flyer ?? ""),
    brand: row.Brand ? String(row.Brand) : undefined,
    statusRaw: String(row.Status ?? ""),
    scannedBy: row.Scanned_By,
    departureDate: row.Departure_Date ?? null,
    createdAt: row.created_at ?? null,
    scannedOn: row.Scanned_On ?? null,
    reportedIT: row.Reported_IT ?? null,
    statuses: placeholder,
  }
}

type QueueRow = {
  pnr: string
  brand: string
  queue_status: string
  client_name: string | null
  departure_date: string | null
  consultant_name: string | null
  pnr_type: string | null
  created_at: string
  added_by: string | null
}

/**
 * Owner scope for the dashboard.
 *
 * `profileId` restricts `pnr_queue` rows to those added by that profile; `fullName`
 * restricts legacy MySQL rows, which only carry the scanner's name (`Scanned_By`).
 * A null scope means "show everything" (admin / super_admin).
 */
type OwnerScope = { profileId: string; fullName: string | null } | null

async function getSupabaseQueueItems(
  brand?: string,
  pnr?: string,
  statusFilter?: string,
  scope?: OwnerScope
): Promise<DashboardPnrItem[]> {
  // Supabase queue items are the "sheet-import" workflow; we only merge the statuses the UI is asking for.
  const statusesToFetch =
    statusFilter === "pending"
      ? ["pending"]
      : statusFilter === "exception"
        ? ["exception"]
        : statusFilter === "done"
          ? ["done"]
          : statusFilter === "all" || !statusFilter
            ? (["pending", "exception", "done"] as const)
            : null

  if (!statusesToFetch) return []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    async function fetchForStatus(queue_status: string): Promise<QueueRow[]> {
      let query = db
        .from("pnr_queue")
        .select(
          "pnr, brand, queue_status, client_name, departure_date, consultant_name, pnr_type, created_at, added_by"
        )
        .eq("queue_status", queue_status)

      if (brand && brand !== "all") query = query.eq("brand", brand)
      if (pnr) query = query.ilike("pnr", `%${pnr}%`)
      if (scope) query = query.eq("added_by", scope.profileId)

      const { data, error } = await query
      if (error || !data) return []
      return data as QueueRow[]
    }

    const rows = (
      await Promise.all(statusesToFetch.map((s) => fetchForStatus(String(s))))
    ).flat()

    // Resolve added_by → display name so the dashboard's "scanned by" column and
    // the admin view-as filter work for sheet-imported rows, not just legacy ones.
    const ownerIds = Array.from(
      new Set(rows.map((r) => r.added_by).filter((v): v is string => !!v))
    )
    const ownerNames = new Map<string, string>()
    for (const [id, owner] of await findDirectoryEntries(ownerIds)) {
      ownerNames.set(id, owner.full_name ?? owner.email ?? "")
    }

    return rows.map((row) => {
      const statusRaw =
        row.queue_status === "exception"
          ? "exception"
          : row.queue_status === "done"
            ? "done"
            : "pending"
      const placeholderTotal: "exception" | "pending" =
        statusRaw === "exception" ? "exception" : "pending"

      return {
        pnr: row.pnr,
        client: row.client_name ?? "",
        consultant: row.consultant_name ?? "",
        source: row.pnr_type || "sheet",
        frequentFlyer: "",
        brand: row.brand,
        statusRaw,
        scannedBy: row.added_by ? (ownerNames.get(row.added_by) ?? null) : null,
        addedBy: row.added_by,
        departureDate: row.departure_date ?? null,
        createdAt: row.created_at,
        scannedOn: null,
        reportedIT: null,
        statuses: {
          flight: placeholderTotal,
          p3: "pending" as const,
          ticket: "pending" as const,
          messages: "pending" as const,
          total: placeholderTotal,
        },
      }
    })
  } catch {
    return []
  }
}

/**
 * PNRs in the queue that belong to somebody else.
 *
 * A PNR transferred to another admin keeps the original scanner's name on the
 * legacy row, so the legacy copy has to be suppressed too or it never leaves the
 * previous owner's dashboard.
 */
async function getForeignOwnedPnrSet(profileId: string): Promise<Set<string>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data } = await db
      .from("pnr_queue")
      .select("pnr")
      .neq("added_by", profileId)
    if (!data) return new Set()
    return new Set((data as { pnr: string }[]).map((r) => r.pnr.toUpperCase()))
  } catch {
    return new Set()
  }
}

/** Returns the set of PNRs explicitly deleted from the queue (tombstones). */
async function getDeletedPnrSet(): Promise<Set<string>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data } = await db.from("pnr_deletions").select("pnr")
    if (!data) return new Set()
    return new Set((data as { pnr: string }[]).map((r) => r.pnr.toUpperCase()))
  } catch {
    return new Set()
  }
}

/**
 * Resolve the caller's own-rows scope.
 *
 * `user` is confined to the PNRs assigned to them. `admin` and `super_admin` see
 * the whole queue and narrow it themselves with the view-as picker.
 */
async function getOwnerScope(): Promise<OwnerScope> {
  const profile = await getPreDepartureUser()
  if (!profile) return null

  const admin = createServiceClient()

  if (!profile || profile.role !== "user") return null
  return { profileId: profile.id, fullName: profile.full_name ?? null }
}

/** Queue workflow (sheet + Scan PNR) wins for bucket + dots when both APIs return the same PNR. */
function overlaySupabaseQueueOntoLegacy(
  legacy: DashboardPnrItem,
  queue: DashboardPnrItem
): DashboardPnrItem {
  return {
    ...legacy,
    statusRaw: queue.statusRaw,
    statuses: queue.statuses,
    brand: queue.brand ?? legacy.brand,
    // Queue ownership wins: `move` reassigns added_by, while the legacy row keeps
    // the original scanner's name forever.
    scannedBy: queue.scannedBy ?? legacy.scannedBy,
    addedBy: queue.addedBy ?? legacy.addedBy,
    client: queue.client?.trim() ? queue.client : legacy.client,
    consultant: queue.consultant?.trim() ? queue.consultant : legacy.consultant,
    departureDate: queue.departureDate ?? legacy.departureDate,
    createdAt: queue.createdAt ?? legacy.createdAt,
    source: queue.source || legacy.source,
  }
}

export type DashboardApiResponse = {
  ok: boolean
  items?: DashboardPnrItem[]
  raw?: LegacyPnrHistoryRow[]
  error?: string
  detail?: string
}

/** `DashboardApiResponse` plus the HTTP status the route should reply with. */
export type DashboardLoadResult = DashboardApiResponse & { status: number }

/**
 * Load the merged dashboard for a query string such as
 * `?pnr=...&brand=...&admin=...&status=...&frequentFlyer=...`.
 *
 * Never throws: a legacy-bridge failure degrades to the Supabase queue items when
 * there are any, and only reports an error when there is nothing at all to show.
 */
export async function loadDashboard(
  search: string
): Promise<DashboardLoadResult> {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  )
  const qs = params.toString()
  const target = `${getLegacyBaseUrl()}/fetchDatabase.php${qs ? `?${qs}` : ""}`

  const brand = params.get("brand") ?? undefined
  const pnrFilter = params.get("pnr") ?? undefined
  const statusFilter = params.get("status") ?? undefined

  const scope = await getOwnerScope()

  // Fetch legacy items + Supabase queue items + deletion tombstones in parallel
  const [legacyResult, queueItems, deletedPnrs, foreignPnrs] =
    await Promise.allSettled([
      fetch(target, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(LEGACY_TIMEOUT_MS),
      }),
      getSupabaseQueueItems(brand, pnrFilter, statusFilter, scope),
      getDeletedPnrSet(),
      scope
        ? getForeignOwnedPnrSet(scope.profileId)
        : Promise.resolve(new Set<string>()),
    ])

  const supabaseItems =
    queueItems.status === "fulfilled" ? queueItems.value : []
  const deletedSet =
    deletedPnrs.status === "fulfilled" ? deletedPnrs.value : new Set<string>()
  const foreignSet =
    foreignPnrs.status === "fulfilled" ? foreignPnrs.value : new Set<string>()

  /** Legacy is unusable — serve the queue alone, or surface the failure. */
  function queueOnlyOr(error: string, detail?: string): DashboardLoadResult {
    if (supabaseItems.length > 0) {
      return { ok: true, items: supabaseItems, raw: [], status: 200 }
    }
    return { ok: false, error, detail, status: error === "Bridge failed" ? 500 : 502 }
  }

  if (legacyResult.status === "rejected") {
    return queueOnlyOr("Bridge failed", String(legacyResult.reason))
  }

  const res = legacyResult.value
  const text = await res.text()

  if (!res.ok) {
    return queueOnlyOr(`Legacy HTTP ${res.status}`, text.slice(0, 500))
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return queueOnlyOr("Invalid JSON from legacy")
  }

  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return {
      ok: false,
      error: (parsed as { error: string }).error,
      status: 502,
    }
  }

  const raw = (Array.isArray(parsed) ? parsed : []) as LegacyPnrHistoryRow[]
  // Exclude PNRs that were explicitly deleted from the Supabase queue.
  const ownName = scope?.fullName?.trim().toLowerCase() ?? null
  const legacyItems = raw
    .filter((r) => !deletedSet.has(String(r.PNR ?? "").toUpperCase()))
    // Legacy rows only carry the scanner's name, so a scoped user matches on that.
    // With no name to match, show nothing rather than the whole queue. A PNR the
    // queue assigns to someone else is hidden regardless of the legacy name.
    .filter(
      (r) =>
        !scope ||
        (ownName !== null &&
          !foreignSet.has(String(r.PNR ?? "").toUpperCase()) &&
          String(r.Scanned_By ?? "")
            .trim()
            .toLowerCase() === ownName)
    )
    .map(normalizeDashboardRow)

  // One row per PNR: legacy first, then overlay `pnr_queue` when present so Scan PNR
  // updates (exception vs pending) are visible even when MySQL already lists the PNR.
  const byPnr = new Map<string, DashboardPnrItem>()
  for (const it of legacyItems) {
    byPnr.set(it.pnr.toUpperCase(), it)
  }
  for (const q of supabaseItems) {
    const key = q.pnr.toUpperCase()
    const existing = byPnr.get(key)
    byPnr.set(key, existing ? overlaySupabaseQueueOntoLegacy(existing, q) : q)
  }

  return { ok: true, items: Array.from(byPnr.values()), raw, status: 200 }
}
