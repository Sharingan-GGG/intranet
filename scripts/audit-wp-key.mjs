#!/usr/bin/env node
/**
 * Issue (or rotate) a WordPress site's Audit Hub plugin key, per environment.
 *
 *   node scripts/audit-wp-key.mjs .env.staging roundabouttravel.com.au
 *   node scripts/audit-wp-key.mjs .env.staging --list
 *   node scripts/audit-wp-key.mjs .env.staging roundabouttravel.com.au --disable
 *
 * Prints the key ONCE. Paste it into the plugin's settings (Settings → Audit Hub)
 * under the matching environment, then click Test connection — that call registers
 * the site's webhook endpoint and hands the plugin its webhook secret.
 *
 * Re-running for a domain rotates both its key and its webhook secret: the old key
 * stops working immediately, and the plugin picks up the new secret on its next
 * Test connection. Only the key's sha256 is stored (audit.wp_connections.key_hash).
 *
 * Like migrate-guard.mjs, it names the target project from POSTGRES_URL and makes
 * you type the environment, since staging and production share one pooler host.
 * Run it on its own — staging's pooler is pool_size 15.
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

import pg from 'pg'

const KNOWN_PROJECTS = {
  mckqcwpnaouqrfnoxils: 'staging',
  qpnyysjakayualiqtvyf: 'production',
}

// Keep in sync with SITES in src/lib/audit-config.ts — the API refuses any other domain anyway.
const DOMAINS = ['roundabouttravel.com.au', 'roundabouttravel.co.nz', 'thewellconnectedtraveller.com.au']

function parseEnvFile(path) {
  const vars = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[line.slice(0, eq).trim()] = value
  }
  return vars
}

function targetOf(postgresUrl) {
  const url = new URL(postgresUrl)
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return 'local'
  const user = decodeURIComponent(url.username || '')
  return KNOWN_PROJECTS[user.slice(user.indexOf('.') + 1)] ?? 'unknown'
}

async function main() {
  const [envFile, ...rest] = process.argv.slice(2)
  const list = rest.includes('--list')
  const disable = rest.includes('--disable')
  const domain = rest.find((a) => !a.startsWith('--'))

  if (!envFile || (!list && !domain)) {
    console.error('Usage: node scripts/audit-wp-key.mjs <env-file> <domain> [--disable]')
    console.error('       node scripts/audit-wp-key.mjs <env-file> --list')
    process.exit(1)
  }
  if (domain && !DOMAINS.includes(domain)) {
    console.error(`Unknown domain "${domain}". One of: ${DOMAINS.join(', ')}`)
    process.exit(1)
  }

  const postgresUrl = parseEnvFile(envFile).POSTGRES_URL
  if (!postgresUrl) {
    console.error(`POSTGRES_URL is not set in ${envFile}.`)
    process.exit(1)
  }
  const target = targetOf(postgresUrl)
  if (target === 'unknown') {
    console.error(`${envFile} points at an unrecognised project — refusing.`)
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: postgresUrl, ssl: target === 'local' ? false : { rejectUnauthorized: false } })
  await client.connect()
  try {
    if (list) {
      const { rows } = await client.query(
        `select domain, enabled, connected_by, webhook_url, plugin_version, created_at, last_seen_at
           from audit.wp_connections order by domain`,
      )
      console.log(`${target.toUpperCase()} — ${rows.length} connection(s)`)
      console.table(rows)
      return
    }

    console.log(`Target: ${target.toUpperCase()} (${envFile})`)
    console.log(disable ? `Disable the plugin key for ${domain}.` : `Issue a new plugin key for ${domain} (replaces any existing key).`)
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question(`Type "${target}" to confirm: `)
    rl.close()
    if (answer.trim() !== target) {
      console.error('Not confirmed — nothing changed.')
      process.exit(1)
    }

    if (disable) {
      const { rowCount } = await client.query(`update audit.wp_connections set enabled = false where domain = $1`, [domain])
      console.log(rowCount ? `Disabled ${domain}.` : `${domain} had no connection.`)
      return
    }

    const key = `ahk_${randomBytes(32).toString('base64url')}`
    const webhookSecret = randomBytes(32).toString('base64url')
    await client.query(
      `insert into audit.wp_connections (domain, key_hash, webhook_secret)
       values ($1, $2, $3)
       on conflict (domain) do update
         set key_hash = excluded.key_hash,
             webhook_secret = excluded.webhook_secret,
             enabled = true`,
      [domain, createHash('sha256').update(key).digest('hex'), webhookSecret],
    )
    console.log(`\n${target.toUpperCase()} key for ${domain} (shown once — paste it into the plugin now):\n\n  ${key}\n`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
