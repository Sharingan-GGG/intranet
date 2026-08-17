#!/usr/bin/env node
// Confirmation gate in front of `payload migrate*` so a copy-pasted command can't
// silently run a migration against the wrong database. Staging and production share
// the same pooler host (aws-0-ap-southeast-2.pooler.supabase.com) — only the
// POSTGRES_URL username (payload_app.<ref> / postgres.<ref>) tells them apart.
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { spawn } from 'node:child_process'

const KNOWN_PROJECTS = {
  mckqcwpnaouqrfnoxils: 'staging',
  qpnyysjakayualiqtvyf: 'production',
}

function parseEnvFile(path) {
  const vars = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

function identifyTarget(postgresUrl) {
  if (!postgresUrl) return { label: 'unknown', detail: 'POSTGRES_URL is not set' }

  let url
  try {
    url = new URL(postgresUrl)
  } catch {
    return { label: 'unknown', detail: 'POSTGRES_URL is not a valid URL' }
  }

  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    return { label: 'local', detail: `${url.hostname}:${url.port || '5432'}` }
  }

  const username = decodeURIComponent(url.username || '')
  const dot = username.indexOf('.')
  const ref = dot === -1 ? null : username.slice(dot + 1)
  const known = ref ? KNOWN_PROJECTS[ref] : undefined

  if (known) return { label: known, detail: `project ref ${ref}` }
  if (ref) return { label: 'unknown', detail: `unrecognised project ref ${ref} — add it to KNOWN_PROJECTS if this is expected` }
  return { label: 'unknown', detail: `could not parse a project ref from username "${username}"` }
}

async function confirm(label) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `\nType "${label}" to confirm you want to run this against ${label.toUpperCase()}: `,
  )
  rl.close()
  return answer.trim() === label
}

async function main() {
  const [envFile, ...payloadArgs] = process.argv.slice(2)

  if (!envFile || payloadArgs.length === 0) {
    console.error('Usage: node scripts/migrate-guard.mjs <env-file> <payload-subcommand> [...args]')
    console.error('Example: node scripts/migrate-guard.mjs .env.production migrate')
    process.exit(1)
  }

  const fileVars = parseEnvFile(envFile)
  const mergedEnv = { ...process.env, ...fileVars }
  const target = identifyTarget(mergedEnv.POSTGRES_URL)

  console.log(`\nEnv file:   ${envFile}`)
  console.log(`Target:     ${target.label.toUpperCase()} (${target.detail})`)
  console.log(`Command:    payload ${payloadArgs.join(' ')}`)

  if (target.label === 'unknown') {
    console.error('\nRefusing to run: could not confirm which database this points at.')
    process.exit(1)
  }

  if (target.label !== 'local') {
    const ok = await confirm(target.label)
    if (!ok) {
      console.error('\nAborted — confirmation did not match.')
      process.exit(1)
    }
  }

  const child = spawn('pnpm', ['payload', ...payloadArgs], {
    stdio: 'inherit',
    env: mergedEnv,
  })

  child.on('exit', (code) => process.exit(code ?? 1))
}

main()
