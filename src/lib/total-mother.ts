import type { TabStatus } from "./pnr-types"

/**
 * Operational total: flight + P3 + ticket only.
 * The Messages tab (SSR / alarms) is excluded so it does not drive queue/scan buckets
 * alongside user Notes (`PNR_Note`) and Report IT (`PNR_Report_IT`), which never feed mothers.
 * Red dot = exception, green = pending for this aggregate.
 */

export type TotalStatusInput = {
  flight: TabStatus
  p3: TabStatus
  ticket: TabStatus
  /** Optional: e.g. #travelling-with-status is always red when that tab exists */
  travellingWith?: TabStatus
}

export function getTotalStatusFromMothers(m: TotalStatusInput): TabStatus {
  const anyRed =
    m.flight === "exception" ||
    m.p3 === "exception" ||
    m.ticket === "exception" ||
    m.travellingWith === "exception"
  return anyRed ? "exception" : "pending"
}
