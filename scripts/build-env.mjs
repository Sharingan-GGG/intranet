import { config } from 'dotenv'
import { spawnSync } from 'child_process'
import { existsSync, renameSync } from 'fs'
import { execSync } from 'child_process'

/**
 * Build with a specific .env file, and make sure it is the one that actually wins.
 *
 * Loading the file into process.env is not enough on its own: Next runs its own env
 * resolution and ranks `.env.local` above `.env.production`/`.env.staging`, so a developer's
 * local file silently decides what gets inlined into every NEXT_PUBLIC_* in the bundle. That
 * is how a production build ended up pointing at the staging Supabase project — a failure
 * with no build error and no visible symptom until users could not sign in. So `.env.local`
 * is moved aside for the duration of the build, and the result is verified before it can ship.
 */
export function buildWithEnv(envFile, { expect } = {}) {
  config({ path: envFile, override: true })

  const stashed = existsSync('.env.local')
  if (stashed) renameSync('.env.local', '.env.local.build-stash')

  let status
  try {
    status = spawnSync('next', ['build'], { stdio: 'inherit', env: process.env, shell: true }).status
  } finally {
    if (stashed) renameSync('.env.local.build-stash', '.env.local')
  }

  if (status !== 0) process.exit(status ?? 1)

  // The inlined value is the only thing that proves which project the bundle talks to.
  if (expect) {
    const { value, reject } = expect
    const hits = (pattern) => {
      try {
        // Only what the deploy actually uploads: `.next/dev` is next-dev scratch that the
        // rsync excludes, and it routinely holds the other environment's ref.
        return execSync(`grep -rl -- ${JSON.stringify(pattern)} .next/server .next/static --include='*.js' | grep -v '\\.map$' | wc -l`)
          .toString().trim()
      } catch {
        return '0'
      }
    }
    const wanted = hits(value)
    const unwanted = reject ? hits(reject) : '0'
    console.log(`\nenv check: ${envFile} -> ${value} in ${wanted} bundle(s), ${reject ?? 'n/a'} in ${unwanted}`)
    if (wanted === '0' || unwanted !== '0') {
      console.error(
        `\n✗ BUILD REJECTED: bundle does not match ${envFile}.\n` +
          `  expected "${value}" (found in ${wanted} files)\n` +
          `  must not contain "${reject}" (found in ${unwanted} files)\n` +
          `  Do not deploy this build.\n`,
      )
      process.exit(1)
    }
    console.log('✓ bundle matches the intended environment\n')
  }
}
