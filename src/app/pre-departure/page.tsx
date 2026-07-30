import { redirect } from "next/navigation"

import { DEFAULT_BRAND } from "@/lib/pre-departure-route"

/**
 * Every Pre Departure view lives under a brand (`/pre-departure/{brand}/…`). This bare
 * entry point stays valid by sending it to the brand the dashboard has always opened
 * on, which every role can see — so no auth or role lookup is needed here; the brand
 * page does both.
 */
export default function PreDepartureIndex() {
  redirect(`/pre-departure/${DEFAULT_BRAND.toLowerCase()}`)
}
