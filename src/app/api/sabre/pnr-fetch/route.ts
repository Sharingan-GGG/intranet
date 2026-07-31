import { NextResponse } from "next/server"

import { extractTicketNumbersFromBookingJson } from "@/lib/sabre/accounting-ticket-numbers"
import {
  type SabrePlatformConfig,
  SabrePlatformAuthError,
  fetchJsonPnr,
  fetchJsonToken,
  fetchSoapP3,
  fetchSoapP4,
  fetchSoapSessionClose,
  fetchSoapToken,
  isSoapAuthFailureReason,
  refreshJsonToken,
  refreshSoapToken,
  resolveSabreSoapBaseUrl,
  sabreSoapCredentialsFromEnv,
} from "@/lib/sabre/platform-client"
import { resolveSabreJsonBaseUrl } from "@/lib/sabre/platform-endpoints"
import { sabreSoapSessionCloseOnDoneEnabled } from "@/lib/sabre/soap-session-token"
import { invalidateSoapToken } from "@/lib/sabre/token-store"
import { parseP3Soap } from "@/lib/sabre/soap-parser"
import type { P3ProcessModel } from "@/lib/p3-process-data"
import { createServiceClient } from "@/lib/supabase/server"
import { ensureBrandId } from "@/lib/supabase/ensure-brand"
import { deriveQueueWorkflowStatusFromScan } from "@/lib/sabre/derive-queue-workflow-from-scan"
import {
  fetchPnrQueueMetadata,
  mergeSheetMetadataForHistory,
  recordInitialScanOutcome,
  upsertPnrQueueWorkflowAfterScan,
} from "@/lib/supabase/pnr-queue-metadata"
import { updateSheetRows } from "@/lib/google-sheets"

type StepRecord = {
  name: string
  status: "pending" | "success" | "error"
  duration_ms?: number
  error?: string
}

export async function POST(req: Request) {
  const steps: StepRecord[] = []

  try {
    const body = (await req.json()) as {
      pnr?: string
      brand?: string
      includeP3?: boolean
      includeP4?: boolean
    }
    const pnr = String(body.pnr ?? "")
      .trim()
      .toUpperCase()
    const brand = body.brand ?? "SABRE"
    const includeP3 = body.includeP3
    const includeP4 = body.includeP4

    if (!/^[A-Z0-9]{6}$/.test(pnr)) {
      return NextResponse.json(
        { error: "Invalid PNR format (6 alphanumeric chars)" },
        { status: 400 }
      )
    }

    const creds = sabreSoapCredentialsFromEnv()
    const config: SabrePlatformConfig = {
      jsonUrl: resolveSabreJsonBaseUrl(),
      soapUrl: resolveSabreSoapBaseUrl(),
      username: creds.username,
      password: creds.password,
      pcc: creds.pcc,
    }

    if (!config.username || !config.password || !config.pcc) {
      return NextResponse.json(
        { error: "Sabre API not configured (set SABRE_SOAP_USERNAME, SABRE_SOAP_PASSWORD, SABRE_SOAP_PCC)" },
        { status: 500 }
      )
    }

    steps.push({ name: "JSON Token", status: "pending" })
    const t1 = Date.now()
    const jsonTokenResult = await fetchJsonToken(config)
    steps[steps.length - 1] = {
      name: "JSON Token",
      status: "success",
      duration_ms: Date.now() - t1,
    }

    steps.push({ name: "JSON GetBooking", status: "pending" })
    const t2 = Date.now()
    let jsonData: Record<string, unknown>
    try {
      jsonData = await fetchJsonPnr(
        pnr,
        jsonTokenResult.accessToken,
        config.jsonUrl
      )
    } catch (err) {
      if (!(err instanceof SabrePlatformAuthError)) throw err
      await refreshJsonToken()
      const refreshed = await fetchJsonToken(config, { forceRefresh: true })
      jsonData = await fetchJsonPnr(pnr, refreshed.accessToken, config.jsonUrl)
    }
    steps[steps.length - 1] = {
      name: "JSON GetBooking",
      status: "success",
      duration_ms: Date.now() - t2,
    }

    const ticketNumbers = extractTicketNumbersFromBookingJson(jsonData)
    const wantP3 = includeP3 ?? true
    const wantP4 = includeP4 !== false
    const needSoap =
      Boolean(config.soapUrl?.trim()) &&
      (wantP3 || (wantP4 && ticketNumbers.length > 0))

    let p3Data: P3ProcessModel | null = null
    let p3Xml: string | null = null
    let p4Data: unknown = null
    let p4Xml: string | null = null

    if (needSoap) {
      if (!config.soapUrl) {
        return NextResponse.json(
          { error: "Sabre SOAP not configured (SABRE_SOAP_BASE_URL)" },
          { status: 500 }
        )
      }

      steps.push({ name: "SOAP Token", status: "pending" })
      let soapToken: string | null = null
      try {
        const t3 = Date.now()
        soapToken = await fetchSoapToken(config)
        steps[steps.length - 1] = {
          name: "SOAP Token",
          status: "success",
          duration_ms: Date.now() - t3,
        }

        if (wantP3) {
          const t4 = Date.now()
          let [p3Result] = await runP3SoapFetch({
            pnr,
            includeP3: true,
            soapToken,
            soapUrl: config.soapUrl,
            soapConfig: config,
          })

          if (hasSoapAuthFailure(p3Result)) {
            await refreshSoapToken()
            soapToken = await fetchSoapToken(config, { forceRefresh: true })
            ;[p3Result] = await runP3SoapFetch({
              pnr,
              includeP3: true,
              soapToken,
              soapUrl: config.soapUrl,
              soapConfig: config,
            })
          }

          const soapDuration = Date.now() - t4

          if (p3Result.status === "fulfilled" && p3Result.value) {
            steps.push({ name: "SOAP P3", status: "pending" })
            try {
              p3Xml = p3Result.value
              p3Data = await parseP3Soap(p3Xml)
              steps[steps.length - 1] = {
                name: "SOAP P3",
                status: "success",
                duration_ms: soapDuration,
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              steps[steps.length - 1] = {
                name: "SOAP P3",
                status: "error",
                duration_ms: soapDuration,
                error: msg,
              }
              throw err
            }
          } else if (p3Result.status === "rejected") {
            steps.push({
              name: "SOAP P3",
              status: "error",
              duration_ms: soapDuration,
              error:
                p3Result.reason instanceof Error
                  ? p3Result.reason.message
                  : String(p3Result.reason),
            })
            throw p3Result.reason
          }
        }

        if (wantP4 && ticketNumbers.length > 0 && soapToken) {
          const p4Xmls: string[] = []
          for (const tk of ticketNumbers) {
            const stepLabel = `SOAP P4 (${tk.length > 4 ? "…" + tk.slice(-4) : tk})`
            steps.push({ name: stepLabel, status: "pending" })
            const tP4 = Date.now()
            try {
              const xml = await fetchSoapP4(
                tk,
                soapToken,
                config.soapUrl,
                config
              )
              p4Xmls.push(xml)
              steps[steps.length - 1] = {
                name: stepLabel,
                status: "success",
                duration_ms: Date.now() - tP4,
              }
            } catch (err) {
              if (isSoapAuthFailureReason(err)) {
                await refreshSoapToken()
                soapToken = await fetchSoapToken(config, { forceRefresh: true })
                const xml = await fetchSoapP4(
                  tk,
                  soapToken,
                  config.soapUrl,
                  config
                )
                p4Xmls.push(xml)
                steps[steps.length - 1] = {
                  name: stepLabel,
                  status: "success",
                  duration_ms: Date.now() - tP4,
                }
              } else {
                const msg = err instanceof Error ? err.message : String(err)
                steps[steps.length - 1] = {
                  name: stepLabel,
                  status: "error",
                  duration_ms: Date.now() - tP4,
                  error: msg,
                }
                throw err
              }
            }
          }
          if (p4Xmls.length > 0) {
            p4Xml = p4Xmls.join("\n<!-- p4-doc-boundary -->\n")
            p4Data = { ticketNumbers, documents: p4Xmls.length }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (steps[steps.length - 1]?.status === "pending") {
          steps[steps.length - 1]!.status = "error"
          steps[steps.length - 1]!.error = msg
        }
        throw err
      } finally {
        if (soapToken && sabreSoapSessionCloseOnDoneEnabled()) {
          const tClose = Date.now()
          steps.push({ name: "SOAP SessionClose", status: "pending" })
          try {
            const closed = await fetchSoapSessionClose(
              soapToken,
              config.soapUrl,
              config
            )
            if (closed) await invalidateSoapToken()
            steps[steps.length - 1] = {
              name: "SOAP SessionClose",
              status: "success",
              duration_ms: Date.now() - tClose,
            }
          } catch (closeErr) {
            steps[steps.length - 1] = {
              name: "SOAP SessionClose",
              status: "error",
              duration_ms: Date.now() - tClose,
              error:
                closeErr instanceof Error
                  ? closeErr.message
                  : String(closeErr),
            }
          }
        }
      }
    }

    steps.push({ name: "Save Supabase", status: "pending" })
    const tSave = Date.now()
    await persistSabrePnrScan({
      pnr,
      brand,
      jsonData,
      p3Xml,
      p3Data,
      p4Xml,
      p4Data,
      steps,
    })
    steps[steps.length - 1] = {
      name: "Save Supabase",
      status: "success",
      duration_ms: Date.now() - tSave,
    }

    return NextResponse.json({
      success: true,
      data: { json: jsonData, p3: p3Data, p4: p4Data },
      steps,
      error: null,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error("[SABRE] pnr-fetch error:", errorMsg)
    if (steps[steps.length - 1]?.status === "pending") {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1]!,
        status: "error",
        error: errorMsg,
      }
    }

    return NextResponse.json(
      { success: false, data: null, steps, error: errorMsg },
      { status: 500 }
    )
  }
}

async function runP3SoapFetch({
  pnr,
  includeP3,
  soapToken,
  soapUrl,
  soapConfig,
}: {
  pnr: string
  includeP3?: boolean
  soapToken: string
  soapUrl: string
  soapConfig: SabrePlatformConfig
}) {
  const p3Promise = includeP3
    ? fetchSoapP3(pnr, soapToken, soapUrl, soapConfig)
    : Promise.resolve(null)
  return Promise.allSettled([p3Promise])
}

function hasSoapAuthFailure(
  ...results: PromiseSettledResult<string | null>[]
): boolean {
  return results.some(
    (result) =>
      result.status === "rejected" && isSoapAuthFailureReason(result.reason)
  )
}

async function persistSabrePnrScan({
  pnr,
  brand,
  jsonData,
  p3Xml,
  p3Data,
  p4Xml,
  p4Data,
  steps,
}: {
  pnr: string
  brand: string
  jsonData: Record<string, unknown>
  p3Xml: string | null
  p3Data: P3ProcessModel | null
  p4Xml: string | null
  p4Data: unknown
  steps: StepRecord[]
}) {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const now = new Date().toISOString()
  const scanBrandId = await ensureBrandId(db, brand)

  // `brand` is the tab the scan was launched from, which is not necessarily the
  // brand the PNR belongs to — a PNR moved to QF is still scannable from the FB
  // dashboard. The queue owns the answer, so file everything under the queued
  // brand and fall back to the scan's own brand only for a PNR the queue has
  // never seen.
  const { data: queuedBrand } = await db
    .from("pnr_queue")
    .select("brand_id")
    .eq("pnr", pnr)
    .maybeSingle()
  const brandId: number = queuedBrand?.brand_id ?? scanBrandId

  const { data: prevHist } = await db
    .from("pnr_history")
    .select("client_name, departure_date, consultant_name, pnr_type")
    .eq("pnr", pnr)
    .maybeSingle()

  const queueMeta = await fetchPnrQueueMetadata(db, pnr, brandId)
  const meta = mergeSheetMetadataForHistory(queueMeta, prevHist, jsonData)

  const { data: historyRow, error: historyError } = await db
    .from("pnr_history")
    .upsert(
      {
        pnr,
        brand_id: brandId,
        status: "SYNCED",
        processed_at: now,
        client_name: meta.client_name,
        departure_date: meta.departure_date,
        consultant_name: meta.consultant_name,
        pnr_type: meta.pnr_type,
        raw_summary: {
          source: "sabre_platform",
          has_json: true,
          has_p3: !!p3Xml,
          has_p4: !!p4Xml,
          steps,
        },
      },
      { onConflict: "pnr", ignoreDuplicates: false }
    )
    .select("id")
    .single()

  if (historyError)
    throw new Error(`Save pnr_history failed: ${historyError.message}`)
  const pnr_history_id = historyRow?.id
  if (!pnr_history_id) throw new Error("Save pnr_history failed: missing id")

  await db.from("pnr_json").delete().eq("pnr_history_id", pnr_history_id)
  await db.from("pnr_p3").delete().eq("pnr_history_id", pnr_history_id)
  await db.from("pnr_ticket").delete().eq("pnr_history_id", pnr_history_id)

  const inserts: Promise<unknown>[] = [
    insertOrThrow(db, "pnr_json", {
      pnr_history_id,
      brand_id: brandId,
      data: jsonData,
      fetched_at: now,
    }),
  ]

  if (p3Xml) {
    inserts.push(
      insertWithOptionalParsedData(db, "pnr_p3", {
        pnr_history_id,
        brand_id: brandId,
        soap_xml: p3Xml,
        data: p3Data,
        fetched_at: now,
      })
    )
  }

  if (p4Xml) {
    inserts.push(
      insertWithOptionalParsedData(db, "pnr_ticket", {
        pnr_history_id,
        brand_id: brandId,
        soap_xml: p4Xml,
        data: p4Data,
        fetched_at: now,
      })
    )
  }

  await Promise.all(inserts)

  const workflow = deriveQueueWorkflowStatusFromScan({
    pnr,
    jsonData,
    p3Xml,
    p4Xml,
  })
  await upsertPnrQueueWorkflowAfterScan(db, {
    pnr,
    brandId,
    queueStatus: workflow,
    processedAt: now,
    meta,
  })

  // Freeze this verdict for the monthly Queue Health rate. Must follow the upsert
  // above, which creates the queue row for a PNR the queue has not seen and whose
  // created_at keys the occurrence. Best-effort: a stats write must not fail a scan
  // whose PNR data has already been persisted.
  try {
    await recordInitialScanOutcome(db, {
      pnr,
      brandId,
      verdict: workflow,
      decidedAt: now,
      consultantName: meta.consultant_name,
    })
  } catch (e) {
    console.error("[pnr-fetch] Failed to record scan outcome:", e)
  }

  // Write pnr_type back to col F when the queue row has a sheet_row reference.
  // Fire-and-forget so sheet latency never blocks the scan response.
  if (meta.pnr_type) {
    const { data: queueRow } = await db
      .from("pnr_queue")
      .select("sheet_row, brand")
      .eq("pnr", pnr)
      .maybeSingle()
    if (queueRow?.sheet_row && queueRow?.brand) {
      updateSheetRows(queueRow.brand, [
        { rowIndex: queueRow.sheet_row, colF: meta.pnr_type },
      ]).catch((e: unknown) =>
        console.error("[pnr-fetch] Failed to write pnr_type to sheet:", e)
      )
    }
  }
}

async function insertOrThrow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  row: Record<string, unknown>
) {
  const { error } = await db.from(table).insert(row)
  if (error) throw new Error(`Save ${table} failed: ${error.message}`)
}

async function insertWithOptionalParsedData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  row: Record<string, unknown>
) {
  const { error } = await db.from(table).insert(row)
  if (!error) return

  if (!/column|schema cache|data/i.test(error.message ?? "")) {
    throw new Error(`Save ${table} failed: ${error.message}`)
  }

  const fallbackRow = { ...row }
  delete fallbackRow.data
  await insertOrThrow(db, table, fallbackRow)
}
