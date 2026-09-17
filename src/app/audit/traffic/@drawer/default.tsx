/**
 * Nothing in the slot when no drawer route matches.
 *
 * Required: without it, a hard load of any URL the slot cannot match 404s the
 * whole layout rather than simply rendering no drawer.
 */
export default function AuditTrafficDrawerDefault() {
  return null
}
