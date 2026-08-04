/**
 * Barrel for PNR vs Tickets compare (legacy soap_ticket / compareJsonTravelers).
 * QA: row counts, Match/UNMATCH, TE + issue date sort, mother, empty/fetch → Exception
 */
export { parseTicketSoap } from "./parse-ticket-soap"
export {
  compareJsonTravelers,
  getCouponsPerTicket,
  type TicketRow,
  type TicketComparisonRow,
} from "./ticket-mother"
