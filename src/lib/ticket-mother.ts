/**
 * PNR vs Tickets — ported from js/soap_ticket.js
 * - getCouponsPerTicket
 * - compareJsonTravelers (mutates tickets: ServiceCoupons[].comparisons)
 * - getTicketStatusFromTickets → `lib/pnr-tickets-pipeline.ts` (single compare pass)
 *
 * DB: PNR_TICKET rows → parse to `TicketRow[]` (your parseTicketSoap output shape).
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- legacy SOAP JSON is dynamic */

export type TicketRow = any

/** compareJsonTravelers → ServiceCoupon.comparisons[] */
export type TicketComparisonRow = {
  field: string
  leftValue: unknown
  rightValue: unknown
  match: boolean
  matchDisplay?: string
}

export function getCouponsPerTicket(data: any): Array<{
  ticketNumber: any
  couponIds: any[]
  flightCoupons: any[]
}> {
  if (!data || !data.flightTickets || data.flightTickets.length === 0) return []
  return data.flightTickets.map((ticket: any) => ({
    ticketNumber: ticket.number,
    couponIds: (ticket.flightCoupons || []).map((coupon: any) => coupon.itemId),
    flightCoupons: ticket.flightCoupons || [],
  }))
}

export function compareJsonTravelers(
  data: any,
  tickets: TicketRow[] | null | undefined
): void {
  if (!data || !tickets) return

  tickets.forEach((ticket: TicketRow) => {
    const customer = ticket.Ticket && ticket.Ticket.Customer
    if (!customer) return

    const getNested = (obj: any, path: string, defaultVal = "") =>
      path
        .split(".")
        .reduce(
          (o: any, key) => (o && o[key] !== undefined ? o[key] : defaultVal),
          obj
        )

    const removeLeadingZeros = (val: any) => {
      const s = String(val || "").trim()
      if (!s) return ""
      const stripped = s.replace(/^0+/, "")
      return stripped === "" ? "0" : stripped
    }

    const fieldMappings: [string, string][] = [
      ["MarketingProvider", "airlineCode"],
      ["MarketingFlightNumber", "flightNumber"],
      ["OperatingProvider", "operatingAirlineCode"],
      ["ClassOfService", "bookingClass"],
      ["StartLocation", "fromAirportCode"],
      ["StartDate", "departureDate"],
      ["StartTime", "departureTime"],
      ["EndLocation", "toAirportCode"],
      ["BookingStatus", "flightStatusName"],
      ["CurrentStatus", "pricingStatusCode"],
    ]

    const pnrTicket = data.flightTickets?.find((t: any) => {
      const n = String(t.number || "").trim()
      const ticketNum = String(ticket.TicketNumber || "").trim()
      return n === ticketNum || n.split("/")[0] === ticketNum
    })
    const travelerForTicket =
      pnrTicket?.travelerIndex && data.travelers
        ? data.travelers[pnrTicket.travelerIndex - 1]
        : null
    const isInfant =
      travelerForTicket &&
      String(travelerForTicket.type || "").toUpperCase() === "INFANT"

    if (
      Array.isArray(ticket.ServiceCoupons) &&
      ticket.ServiceCoupons.length > 0
    ) {
      ticket.ServiceCoupons.forEach((serviceCoupon: any) => {
        /** Must be in scope for both matchedFlight search and fieldMappings (legacy keyFields) */
        const keyFields: [string, string][] = [
          ["MarketingFlightNumber", "flightNumber"],
          ["StartLocation", "fromAirportCode"],
          ["EndLocation", "toAirportCode"],
        ]

        serviceCoupon.comparisons = []

        let matchedFlight: any = null
        if (Array.isArray(data.flights)) {
          matchedFlight =
            data.flights.find((flight: any) => {
              if (!flight) return false
              let couponMatch = false
              if (Array.isArray(flight.flightCoupons)) {
                couponMatch = flight.flightCoupons.some(
                  (fc: any) =>
                    fc.ticketNumber === ticket.TicketNumber &&
                    (fc.couponNumber === serviceCoupon.coupon ||
                      fc.sequence === serviceCoupon.coupon)
                )
              }
              const fieldMatch = keyFields.every(([leftKey, rightKey]) => {
                let lv = serviceCoupon[leftKey] ?? ""
                let rv = flight[rightKey] ?? ""
                if (leftKey === "MarketingFlightNumber") {
                  lv = removeLeadingZeros(lv)
                  rv = removeLeadingZeros(rv)
                } else {
                  lv = String(lv).trim()
                  rv = String(rv).trim()
                }
                return lv && lv === rv
              })
              return couponMatch || fieldMatch
            }) || null
        } else if (data.flights) {
          matchedFlight = data.flights
        }

        const CurrentStatus = "OPEN"

        let matchedFareBasis = ""
        if (
          Array.isArray(data.fares) &&
          matchedFlight &&
          matchedFlight.itemId
        ) {
          outerFareLoop: for (const fare of data.fares) {
            if (Array.isArray(fare.fareConstruction)) {
              for (const fareConstruction of fare.fareConstruction) {
                if (Array.isArray(fareConstruction.flights)) {
                  for (const flight of fareConstruction.flights) {
                    if (
                      String(flight.itemId) === String(matchedFlight.itemId)
                    ) {
                      matchedFareBasis = fareConstruction.fareBasisCode || ""
                      break outerFareLoop
                    }
                  }
                } else if (
                  !fareConstruction.flights &&
                  fareConstruction.fareBasisCode
                ) {
                  matchedFareBasis = fareConstruction.fareBasisCode
                  break outerFareLoop
                }
              }
            }
          }
        }

        let matchedCoupon: any = null
        if (Array.isArray(data.flightTickets)) {
          for (const ft of data.flightTickets) {
            if (Array.isArray(ft.flightCoupons)) {
              const foundCoupon = ft.flightCoupons.find(
                (fc: any) => String(fc.itemId) === String(matchedFlight?.itemId)
              )
              if (foundCoupon) {
                matchedCoupon = foundCoupon
                break
              }
            }
          }
        }

        fieldMappings.forEach(([key, rightPath]) => {
          let leftValue = serviceCoupon[key] ?? ""
          let rightValue: any

          if (key === "MarketingFlightNumber") {
            leftValue = removeLeadingZeros(leftValue)
            if (matchedFlight)
              rightValue = removeLeadingZeros(matchedFlight.flightNumber || "")
          } else if (key === "flightStatusName" || key === "BookingStatus") {
            if (rightPath && matchedFlight) {
              rightValue = getNested(matchedFlight, rightPath, "")
              if (rightValue === "Confirmed") rightValue = "OK"
            }
          } else if (key === "FareBasis") {
            rightValue = matchedFareBasis
          } else if (key === "CurrentStatus") {
            rightValue = CurrentStatus
          } else if (key === "CurrentStatusCodeSetValue") {
            rightValue = matchedCoupon?.couponStatusCode || ""
          } else if (rightPath) {
            rightValue = ""
            const sources = [matchedFlight, data]
            for (const source of sources) {
              if (!source) continue
              if (Array.isArray(source)) {
                for (const item of source) {
                  const val = getNested(item, rightPath, "")
                  if (val !== undefined && val !== "") {
                    rightValue = val
                    break
                  }
                }
              } else {
                const val = getNested(source, rightPath, "")
                if (val !== undefined && val !== "") rightValue = val
              }
              if (rightValue !== "") break
            }
          }

          if (
            keyFields.some(([leftKey, rightKey]) => {
              let lv = serviceCoupon[leftKey] ?? ""
              let rv = matchedFlight ? (matchedFlight[rightKey] ?? "") : ""
              if (leftKey === "MarketingFlightNumber") {
                lv = removeLeadingZeros(lv)
                rv = removeLeadingZeros(rv)
              } else {
                lv = String(lv).trim()
                rv = String(rv).trim()
              }
              return lv === rv
            }) === false
          ) {
            rightValue = ""
          }

          if (key === "StartTime" && rightPath === "departureTime") {
            const leftTime = Array.isArray(leftValue) ? leftValue[0] : leftValue
            const rightTime = Array.isArray(rightValue)
              ? rightValue[0]
              : rightValue

            const parseTime = (timeStr: string) => {
              if (!timeStr) return null
              const [hh, mm, ss] = timeStr.split(":").map(Number)
              return new Date(2000, 0, 1, hh || 0, mm || 0, ss || 0)
            }

            const leftDate = leftTime ? parseTime(String(leftTime)) : null
            const rightDate = rightTime ? parseTime(String(rightTime)) : null

            let diffMinutes: number | null = null
            let match = false

            if (
              leftDate instanceof Date &&
              !isNaN(leftDate.getTime()) &&
              rightDate instanceof Date &&
              !isNaN(rightDate.getTime())
            ) {
              diffMinutes = Math.abs(
                (leftDate.getTime() - rightDate.getTime()) / 60000
              )
              match = diffMinutes <= 55
            } else {
              match = leftTime === rightTime
            }

            let diffDisplay = ""
            if (
              diffMinutes !== null &&
              !isNaN(diffMinutes) &&
              diffMinutes > 0 &&
              diffMinutes <= 55
            ) {
              diffDisplay = ` (${Math.round(diffMinutes)})`
            }

            serviceCoupon.comparisons.push({
              field: key,
              leftValue: leftTime,
              rightValue: rightTime,
              match,
              matchDisplay: (match ? "Match" : "UNMATCH") + diffDisplay,
            })
            return
          }

          const leftArray = Array.isArray(leftValue) ? leftValue : [leftValue]
          const rightArray = Array.isArray(rightValue)
            ? rightValue
            : [rightValue]

          if (key === "BookingStatus") {
            for (let i = 0; i < leftArray.length; i++) {
              if (leftArray[i] === "Confirmed") leftArray[i] = "OK"
            }
            for (let i = 0; i < rightArray.length; i++) {
              if (rightArray[i] === "Confirmed") rightArray[i] = "OK"
            }
          }

          let match: boolean
          if (key === "MarketingFlightNumber") {
            match = leftArray.some((lv) =>
              rightArray.some((rv) => String(lv) === String(rv))
            )
          } else {
            match = leftArray.some((lv) => rightArray.some((rv) => lv === rv))
          }

          const ticketCurrentStatus = String(serviceCoupon.CurrentStatus ?? "")
            .trim()
            .toUpperCase()
          const ticketBookingStatus = leftArray.map((v) =>
            String(v ?? "")
              .trim()
              .toUpperCase()
          )
          const ticketIsNS = ticketBookingStatus.some((v) => v === "NS")
          if (
            key === "BookingStatus" &&
            isInfant &&
            ticketCurrentStatus === "OPEN" &&
            ticketIsNS
          ) {
            match = true
          }

          let matchDisplay: string | undefined
          if (key === "CurrentStatusCodeSetValue" && match === true) {
            matchDisplay =
              "Match" +
              (matchedCoupon?.couponStatus
                ? " (" + matchedCoupon.couponStatus + ")"
                : "")
          }

          serviceCoupon.comparisons.push({
            field: key,
            leftValue: Array.isArray(leftValue) ? leftArray : leftArray[0],
            rightValue: Array.isArray(rightValue) ? rightArray : rightArray[0],
            match,
            ...(typeof matchDisplay !== "undefined" ? { matchDisplay } : {}),
          })
        })
      })
    }
  })
}

function ticketIssueDateIso(t: TicketRow): string {
  const dt = t?.details?.LocalIssueDateTime
  return dt ? String(dt).split("T")[0] : ""
}

/** sortComparisonsByDate: TE first, then latest issue date (renderCompareTable order hint) */
export function sortTicketsForCompareDisplay(
  tickets: TicketRow[]
): TicketRow[] {
  return tickets.slice().sort((a, b) => {
    const aTe = String(a?.ticketStatusCode || "").toUpperCase() === "TE" ? 0 : 1
    const bTe = String(b?.ticketStatusCode || "").toUpperCase() === "TE" ? 0 : 1
    if (aTe !== bTe) return aTe - bTe
    return ticketIssueDateIso(b).localeCompare(ticketIssueDateIso(a))
  })
}

export function ticketBlockHasUnmatch(ticket: TicketRow): boolean {
  if (!Array.isArray(ticket?.ServiceCoupons)) return false
  return ticket.ServiceCoupons.some(
    (c: any) =>
      Array.isArray(c?.comparisons) &&
      c.comparisons.some((row: TicketComparisonRow) => !row.match)
  )
}

export function attachPnrTicketMetadata(
  bookingData: any,
  ticketItem: TicketRow
): void {
  const src = bookingData || {}
  const ticketNum = String(ticketItem.TicketNumber || "").trim()
  const pnrTicket = src.flightTickets?.find((t: any) => {
    const n = String(t.number || "").trim()
    return n === ticketNum || n.split("/")[0] === ticketNum
  })
  ticketItem.ticketStatusCode = pnrTicket?.ticketStatusCode ?? ""
  ticketItem.ticketStatusName = pnrTicket?.ticketStatusName ?? ""
  ticketItem.ticketingPcc = pnrTicket?.ticketingPcc ?? ""
  ticketItem.travelerIndex = pnrTicket?.travelerIndex ?? 0
  const traveler =
    pnrTicket?.travelerIndex && src.travelers
      ? src.travelers[pnrTicket.travelerIndex - 1]
      : null
  ticketItem.passengerName = traveler
    ? `${traveler.givenName || ""} ${traveler.surname || ""}`.trim()
    : ""
}
