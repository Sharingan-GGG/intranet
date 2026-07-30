/**
 * Ported from /pre/js/soap_ticket.js — xmlToJson + parseTicketSoap.
 * PNR_TICKET rows: { ticket, soap } → flattened ticket objects with ServiceCoupons (no comparisons until compareJsonTravelers).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy SOAP / XML is dynamic */

/** Recursive XML → JSON (legacy) */
function xmlToJson(xml: string): Record<string, any> {
  const tagRegex = /<(\w+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g
  const obj: Record<string, any> = {}
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(xml)) !== null) {
    const tag = match[1]
    const inner = match[2].trim()
    if (/<\w+>/.test(inner)) {
      obj[tag] = xmlToJson(inner)
    } else {
      obj[tag] = inner
    }
  }
  return obj
}

/**
 * @param ticketNumber PNR_TICKET.Ticket (row id from DB)
 * @param soapXml Full SOAP response XML
 * @returns Array of one or more <Ticket> blocks, or `null` on throw
 */
export function parseTicketSoap(
  ticketNumber: string,
  soapXml: string
): any[] | null {
  try {
    const bodyMatch = soapXml.match(
      /<soap-env:Body[^>]*>([\s\S]*?)<\/soap-env:Body>/i
    )
    const bodyXml = bodyMatch ? bodyMatch[1] : soapXml

    const agentMatch = bodyXml.match(/<Agent\b[^>]*>([\s\S]*?)<\/Agent>/)
    const agent = agentMatch ? xmlToJson(agentMatch[1]) : {}

    const txnMatch = bodyXml.match(
      /<TransactionInfo\b[^>]*>([\s\S]*?)<\/TransactionInfo>/i
    )
    const transactionInfo = txnMatch ? xmlToJson(txnMatch[1]) : {}

    const ticketsRegex = /<Ticket\b[^>]*>([\s\S]*?)<\/Ticket>/g
    let ticketMatch: RegExpExecArray | null
    const tickets: any[] = []

    while ((ticketMatch = ticketsRegex.exec(bodyXml)) !== null) {
      const ticketXml = ticketMatch[1].trim()
      const ticketJson = xmlToJson(ticketXml)

      const detailsMatch = ticketXml.match(
        /<Details\b[^>]*>([\s\S]*?)<\/Details>/i
      )
      const details = detailsMatch ? xmlToJson(detailsMatch[1].trim()) : {}

      const ticketNumberMatch = ticketMatch[0].match(/number="([^"]+)"/)
      const extractedTicketNumber = ticketNumberMatch
        ? ticketNumberMatch[1]
        : ticketNumber

      const serviceCouponRegex =
        /<ServiceCoupon\b[^>]*>([\s\S]*?)<\/ServiceCoupon>/g
      let couponMatch: RegExpExecArray | null
      const serviceCoupons: any[] = []
      while ((couponMatch = serviceCouponRegex.exec(ticketXml)) !== null) {
        serviceCoupons.push(xmlToJson(couponMatch[1].trim()))
      }

      const relatedDocument = ticketJson.RelatedDocument || {}

      tickets.push({
        TicketNumber: extractedTicketNumber,
        Agent: agent,
        TransactionInfo: transactionInfo,
        Ticket: ticketJson,
        Conjunctive: relatedDocument.Conjunctive || {},
        Original: relatedDocument.Original || {},
        ServiceCoupons: serviceCoupons,
        details,
      })
    }

    return tickets
  } catch (e) {
    console.error(`Error parsing SOAP for ticket ${ticketNumber}:`, e)
    return null
  }
}
