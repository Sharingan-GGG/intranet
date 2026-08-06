/**
 * One-off data setup: consolidates the flat quick-links (each currently its own
 * single-link template) into one shared "Company Tools" template, then creates
 * an empty quick-link template per department for admins to fill in.
 *
 *   payload run scripts/setup-quick-link-groups.ts
 *
 * Safe to re-run: skips creating "Company Tools" if it already exists, and skips
 * any department that already has a template tagged to it.
 */
import { getPayload } from 'payload'

import config from '@payload-config'

const payload = await getPayload({ config })

const { docs: existing } = await payload.find({
  collection: 'quick-links',
  limit: 100,
  depth: 0,
  overrideAccess: true,
})

const untagged = existing.filter((doc) => !doc.department || doc.department.length === 0)
const companyTools = existing.find((doc) => doc.name === 'Company Tools')

if (!companyTools && untagged.length > 0) {
  const links = untagged.flatMap((doc) =>
    (doc.links ?? []).map(({ label, image, link }) => ({ label, image, link })),
  )

  await payload.create({
    collection: 'quick-links',
    data: {
      name: 'Company Tools',
      order: 0,
      links,
    },
    overrideAccess: true,
  })

  for (const doc of untagged) {
    await payload.delete({ collection: 'quick-links', id: doc.id, overrideAccess: true })
  }

  console.log(`merged ${untagged.length} links into "Company Tools"`)
} else {
  console.log('"Company Tools" already exists, or nothing to merge — skipped')
}

const { docs: departments } = await payload.find({
  collection: 'departments',
  limit: 1000,
  depth: 0,
  overrideAccess: true,
})

let created = 0
for (const department of departments) {
  const { docs: matches } = await payload.find({
    collection: 'quick-links',
    where: { department: { contains: department.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (matches.length > 0) continue

  await payload.create({
    collection: 'quick-links',
    data: {
      name: `${department.name} Quick Links`,
      order: 100,
      department: [department.id],
      links: [],
    },
    overrideAccess: true,
  })
  created++
}

console.log(`created ${created} department template(s)`)
process.exit(0)
