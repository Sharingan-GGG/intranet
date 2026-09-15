import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Assignee, Team } from './audit-types'

/**
 * Who can be assigned audit findings, derived from Payload departments.
 *
 * The standalone portal hardcoded two arrays of first names
 * (`MARKETING_ROLES` / `IT_ROLES`) and wrote those bare names into
 * `seo_agent_tracker.assigned`. Those nine names turned out to be exactly the
 * Marketing and IT departments, so the roster is a query now: adding a marketer
 * to the department is all it takes to make them assignable, and nobody has to
 * remember to edit a constant.
 *
 * Assignments are stored as **emails**, not names. Email is already the join key
 * between Supabase Auth and Payload users everywhere else in this codebase, and
 * unlike a display name it survives someone changing theirs.
 */

/** Department names whose members own audit work, and the team each maps to. */
const TEAM_DEPARTMENTS: Record<string, Team> = {
  Marketing: 'marketing',
  IT: 'it',
}

/**
 * Wrapped in React's `cache` so the Dashboard, the assign menu and the
 * per-team finding counts share one query per request rather than three.
 */
export const getAuditRoster = cache(async (): Promise<Assignee[]> => {
  const payload = await getPayload({ config })

  const departments = await payload.find({
    collection: 'departments',
    where: { name: { in: Object.keys(TEAM_DEPARTMENTS) } },
    limit: 100,
    pagination: false,
  })

  const teamByDepartmentId = new Map<string, Team>()
  for (const dept of departments.docs) {
    const team = TEAM_DEPARTMENTS[dept.name as string]
    if (team) teamByDepartmentId.set(String(dept.id), team)
  }
  if (!teamByDepartmentId.size) return []

  const users = await payload.find({
    collection: 'users',
    where: { department: { in: [...teamByDepartmentId.keys()] } },
    limit: 500,
    pagination: false,
    depth: 0,
  })

  const roster: Assignee[] = []
  for (const user of users.docs) {
    const departmentId = String(
      typeof user.department === 'object' && user.department !== null
        ? user.department.id
        : user.department,
    )
    const team = teamByDepartmentId.get(departmentId)
    if (!team) continue
    roster.push({
      id: String(user.id),
      name: user.name ?? user.email,
      email: user.email,
      team,
    })
  }

  return roster.sort((a, b) => a.name.localeCompare(b.name))
})

/** The roster split by team, for the two-column assign menu. */
export async function getAuditTeams(): Promise<
  { key: Team; label: string; members: Assignee[] }[]
> {
  const roster = await getAuditRoster()
  return [
    { key: 'marketing', label: 'Marketing', members: roster.filter((r) => r.team === 'marketing') },
    { key: 'it', label: 'IT', members: roster.filter((r) => r.team === 'it') },
  ]
}
