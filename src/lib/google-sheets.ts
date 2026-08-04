import { createSign } from "crypto"

const SHEET_ID = "1diT87FqPNI6prKRVfrltYcxW1XoE5ZCu7HbBWsDw_-8"
const SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

let _cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 30_000) {
    return _cachedToken.token
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are required"
    )
  }

  const privateKey = rawKey.replace(/\\n/g, "\n")
  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url")

  const sign = createSign("RSA-SHA256")
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(privateKey, "base64url")
  const jwt = `${header}.${payload}.${sig}`

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Google token error ${res.status}: ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    access_token: string
    expires_in: number
  }
  _cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return _cachedToken.token
}

export async function getSheetTabs(): Promise<string[]> {
  const token = await getAccessToken()
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!res.ok) throw new Error(`Sheets metadata error ${res.status}`)
  const json = (await res.json()) as {
    sheets: { properties: { title: string } }[]
  }
  return json.sheets.map((s) => s.properties.title)
}

export type SheetRow = {
  rowIndex: number
  client_name: string
  departure_date: string
  consultant_name: string
  pnr: string
  marked: string
  pnr_type: string
  status: string
  scanned_by: string
}

export async function getSheetRows(brand: string): Promise<SheetRow[]> {
  const token = await getAccessToken()
  const range = `${brand}!A:H`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Sheets read error ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { values?: string[][] }
  const rawRows = json.values ?? []

  return rawRows
    .slice(1) // skip header row (row 1 in sheets)
    .map((row, i) => ({
      rowIndex: i + 2, // header is row 1, so data starts at row 2
      client_name: row[0] ?? "",
      departure_date: row[1] ?? "",
      consultant_name: row[2] ?? "",
      pnr: row[3]?.trim().toUpperCase() ?? "",
      marked: row[4] ?? "",
      pnr_type: row[5] ?? "",
      status: row[6] ?? "",
      scanned_by: row[7] ?? "",
    }))
    .filter((row) => row.pnr) // must have PNR in col D
}

export type SheetRowUpdate = {
  rowIndex: number
  colE?: string
  colF?: string
  colG?: string
  scannedBy?: string
}

/**
 * Write columns E, F (pnr_type), G (status), and H (scanned_by) for multiple rows
 * in a single batchUpdate call.
 */
export async function updateSheetRows(
  brand: string,
  entries: SheetRowUpdate[]
): Promise<void> {
  if (entries.length === 0) return

  const token = await getAccessToken()

  const data: Array<{ range: string; values: string[][] }> = []
  for (const { rowIndex, colE, colF, colG, scannedBy } of entries) {
    if (colE !== undefined) {
      data.push({ range: `${brand}!E${rowIndex}`, values: [[colE]] })
    }
    if (colF !== undefined) {
      data.push({ range: `${brand}!F${rowIndex}`, values: [[colF]] })
    }
    if (colG !== undefined) {
      data.push({ range: `${brand}!G${rowIndex}`, values: [[colG]] })
    }
    if (scannedBy !== undefined) {
      data.push({ range: `${brand}!H${rowIndex}`, values: [[scannedBy]] })
    }
  }

  if (data.length === 0) return

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ valueInputOption: "RAW", data }),
      cache: "no-store",
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Sheets write error ${res.status}: ${detail.slice(0, 200)}`)
  }
}

export function markSheetRowsSynced(
  brand: string,
  rowIndices: number[],
  scannedBy: string
): Promise<void> {
  return updateSheetRows(
    brand,
    rowIndices.map((i) => ({ rowIndex: i, colE: "SYNCED", scannedBy }))
  )
}

export function markSheetRowsDuplicated(
  brand: string,
  rowIndices: number[],
  scannedBy: string
): Promise<void> {
  return updateSheetRows(
    brand,
    rowIndices.map((i) => ({ rowIndex: i, colE: "DUPLICATED", scannedBy }))
  )
}

export function markSheetRowsNoFlight(
  brand: string,
  rowIndices: number[],
  scannedBy: string
): Promise<void> {
  return updateSheetRows(
    brand,
    rowIndices.map((i) => ({ rowIndex: i, colE: "No Flight", scannedBy }))
  )
}

export async function getSheetIdByTitle(title: string): Promise<number> {
  const token = await getAccessToken()
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!res.ok) throw new Error(`Sheets metadata error ${res.status}`)
  const json = (await res.json()) as {
    sheets: { properties: { sheetId: number; title: string } }[]
  }
  const sheet = json.sheets.find((s) => s.properties.title === title)
  if (!sheet) throw new Error(`Sheet "${title}" not found`)
  return sheet.properties.sheetId
}

export async function deleteSheetRowsByIndex(
  sheetId: number,
  rowIndices: number[]
): Promise<void> {
  if (rowIndices.length === 0) return

  const token = await getAccessToken()

  // Sort in descending order to delete from bottom up
  const sorted = [...rowIndices].sort((a, b) => b - a)

  const requests = sorted.map((rowIndex) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: rowIndex - 1, // Sheets API is 0-indexed
        endIndex: rowIndex,
      },
    },
  }))

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
      cache: "no-store",
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Sheets delete error ${res.status}: ${detail.slice(0, 200)}`)
  }
}

export async function appendToSheetTab(
  tabName: string,
  rows: (string | number)[][]
): Promise<void> {
  if (rows.length === 0) return

  const token = await getAccessToken()
  const range = `${tabName}!A:H`

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
      cache: "no-store",
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Sheets append error ${res.status}: ${detail.slice(0, 200)}`)
  }
}
