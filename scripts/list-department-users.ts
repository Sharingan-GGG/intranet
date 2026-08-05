/**
 * Lists every Department alongside the Google Workspace users currently in its OU.
 *
 *   pnpm list:department-users
 *
 * Reads live from the Directory API (not from Payload's Users.department field, which
 * nothing auto-populates yet) — this is "who's really in this OU right now."
 */
import { getPayload } from 'payload'

import config from '@payload-config'
import { listUsersInOu } from '../src/lib/google-admin'

const payload = await getPayload({ config })

const { docs: departments } = await payload.find({
  collection: 'departments',
  where: { orgUnitPath: { exists: true } },
  limit: 100,
  depth: 0,
  overrideAccess: true,
  sort: 'orgUnitPath',
})

for (const dept of departments) {
  const users = await listUsersInOu(dept.orgUnitPath as string)
  console.log(`\n${dept.orgUnitPath} (${dept.name}) — ${users.length} users`)
  for (const u of users) {
    console.log(`  ${u.primaryEmail}${u.suspended ? ' (suspended)' : ''}`)
  }
}

process.exit(0)
