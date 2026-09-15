import type { ContentType } from './audit-types'

/**
 * Sites the Audit Hub can point at. Add a site = add one entry here.
 * `domain` is the bare host (no protocol, no trailing slash).
 * `types` controls which content-type tabs the site shows and what gets fetched.
 */
export interface Site {
  /** Full display name. */
  label: string
  /** Short name used in dropdowns and the Domain List. */
  short: string
  domain: string
  types: readonly ContentType[]
}

export const SITES: readonly Site[] = [
  {
    label: 'RoundAbout Travel Australia',
    short: 'RAT AU',
    domain: 'roundabouttravel.com.au',
    types: ['post', 'page', 'deal'],
  },
  {
    label: 'RoundAbout Travel New Zealand',
    short: 'RAT NZ',
    domain: 'roundabouttravel.co.nz',
    types: ['post', 'page', 'deal'],
  },
  {
    label: 'The Well Connected Traveller',
    short: 'TWCT',
    domain: 'thewellconnectedtraveller.com.au',
    types: ['post', 'page'],
  },
] as const

/** Default site shown on the Dashboard and Completed table: RAT AU. */
export const DEFAULT_SITE: Site = SITES[0]!

export function siteByDomain(domain: string): Site {
  return SITES.find((s) => s.domain === domain) ?? DEFAULT_SITE
}

/** WP REST per_page cap. */
export const WP_PER_PAGE = 100
