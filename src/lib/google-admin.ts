import { createSign } from 'crypto'

const SCOPE =
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly https://www.googleapis.com/auth/admin.directory.user.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// The Admin SDK Directory API only accepts domain-wide-delegated requests, which need a
// `sub` claim naming a real Workspace super-admin to impersonate — a plain service-account
// token (as used for Sheets in google-sheets.ts) gets a 403. Hence a separate token/scope
// from that file rather than sharing its getAccessToken().
async function getAdminAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY
  const subject = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL

  if (!email || !rawKey || !subject) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_WORKSPACE_ADMIN_EMAIL are required',
    )
  }

  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      sub: subject,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(privateKey, 'base64url')
  const jwt = `${header}.${payload}.${sig}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Google token error ${res.status}: ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

export type OrgUnit = {
  name: string
  orgUnitPath: string
  parentOrgUnitPath: string
}

/** Lists every OU in the Workspace directory, root ("/") excluded. */
export async function listOrgUnits(): Promise<OrgUnit[]> {
  const token = await getAdminAccessToken()
  const res = await fetch(
    'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits?type=all',
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Directory API error ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { organizationUnits?: OrgUnit[] }
  return (json.organizationUnits ?? []).filter((ou) => ou.orgUnitPath !== '/')
}

export type WorkspaceUser = {
  primaryEmail: string
  name: { fullName: string }
  orgUnitPath: string
  suspended: boolean
}

/** Lists every active-or-suspended Workspace user directly in the given OU (not sub-OUs). */
export async function listUsersInOu(orgUnitPath: string): Promise<WorkspaceUser[]> {
  const token = await getAdminAccessToken()
  const users: WorkspaceUser[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      customer: 'my_customer',
      query: `orgUnitPath='${orgUnitPath}'`,
      maxResults: '500',
      fields: 'nextPageToken,users(primaryEmail,name,orgUnitPath,suspended)',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Directory API error ${res.status}: ${detail.slice(0, 200)}`)
    }
    const json = (await res.json()) as { users?: WorkspaceUser[]; nextPageToken?: string }
    users.push(...(json.users ?? []))
    pageToken = json.nextPageToken
  } while (pageToken)

  return users
}

/** Looks up a single Workspace user's current OU by email. Returns null if not found. */
export async function getUserOrgUnit(email: string): Promise<string | null> {
  const token = await getAdminAccessToken()
  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?fields=orgUnitPath`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Directory API error ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { orgUnitPath?: string }
  return json.orgUnitPath ?? null
}
