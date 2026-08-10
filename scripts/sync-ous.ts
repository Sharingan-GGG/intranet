/**
 * Imports Google Workspace Organizational Units into Payload's Departments collection.
 *
 *   pnpm sync:ous
 *
 * Matches existing departments by orgUnitPath so it's safe to re-run after the Workspace
 * org structure changes. Parents are always upserted before children (by path depth) so
 * the `parent` relationship can be wired up in one pass.
 */
import { getPayload } from 'payload'

import config from '@payload-config'
import { listOrgUnits } from '../src/lib/google-admin'

const payload = await getPayload({ config })

const orgUnits = await listOrgUnits()
orgUnits.sort(
  (a, b) => a.orgUnitPath.split('/').length - b.orgUnitPath.split('/').length,
)

const departmentIdByPath = new Map<string, string>()

for (const ou of orgUnits) {
  const leafName = ou.orgUnitPath.split('/').pop() ?? ou.name
  const parentId =
    ou.parentOrgUnitPath === '/' ? undefined : departmentIdByPath.get(ou.parentOrgUnitPath)

  const { docs } = await payload.find({
    collection: 'departments',
    where: { orgUnitPath: { equals: ou.orgUnitPath } },
    limit: 1,
    overrideAccess: true,
  })
  const existing = docs[0]

  if (existing) {
    await payload.update({
      collection: 'departments',
      id: existing.id,
      data: { name: leafName, parent: parentId ?? null },
      overrideAccess: true,
    })
    departmentIdByPath.set(ou.orgUnitPath, existing.id)
    console.log(`  updated ${ou.orgUnitPath}`)
  } else {
    const created = await payload.create({
      collection: 'departments',
      data: { name: leafName, orgUnitPath: ou.orgUnitPath, parent: parentId },
      overrideAccess: true,
    })
    departmentIdByPath.set(ou.orgUnitPath, created.id)
    console.log(`  created ${ou.orgUnitPath}`)
  }
}

console.log(`\nsynced ${orgUnits.length} org units`)
process.exit(0)
