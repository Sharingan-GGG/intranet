/**
 * Next.js / dotenv only assigns a single line to each KEY=value. Multiline SOAP
 * templates in `.env.local` (value continues on the next line after `KEY=`) are
 * therefore **empty in process.env** — this module re-reads `.env.local` / `.env`
 * on the server and extracts those blocks so SessionCreate / TokenCreate XML works.
 */

import fs from "node:fs"
import path from "node:path"

const ENV_CANDIDATES = [".env.local", ".env"] as const

function escapeRegexKey(key: string): string {
  return key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function readFirstEnvFile(): string | null {
  for (const name of ENV_CANDIDATES) {
    const p = path.join(process.cwd(), name)
    try {
      return fs.readFileSync(p, "utf8")
    } catch {
      /* missing or unreadable */
    }
  }
  return null
}

/**
 * Parse `KEY=` multiline value from raw dotenv file text.
 * Continuation until a new top-level assignment `OTHER_KEY=` (not XML `<...`).
 * Full-line `#` comments inside the block are skipped (section headers in .env).
 */
export function parseMultilineEnvValue(
  fileContent: string,
  key: string
): string | undefined {
  const lines = fileContent.split(/\r?\n/)
  const prefix = new RegExp(`^${escapeRegexKey(key)}\\s*=\\s*(.*)$`)

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(prefix)
    if (!m) continue

    const parts: string[] = []
    const firstLineRest = m[1] ?? ""
    if (firstLineRest.trim()) parts.push(firstLineRest)

    let j = i + 1
    while (j < lines.length) {
      const line = lines[j]
      const trimmed = line.trim()

      // Next variable assignment at column 0 (after trim): FOO_BAR=
      if (/^[A-Z_][A-Z0-9_]*\s*=/.test(trimmed)) break

      // Standalone .env comment line (e.g. "# Soap ...") — do not append to XML
      if (/^\s*#/.test(line)) {
        j++
        continue
      }

      parts.push(line)
      j++
    }

    const value = parts.join("\n").trim()
    return value || undefined
  }

  return undefined
}

/** SOAP XML from process.env, or multiline block from `.env.local` / `.env`. */
export function resolveSoapXmlFromEnv(key: string): string | undefined {
  const inline = process.env[key]?.trim()
  if (inline) return inline

  const file = readFirstEnvFile()
  if (!file) return undefined

  return parseMultilineEnvValue(file, key)
}
