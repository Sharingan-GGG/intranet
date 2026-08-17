import { config } from 'dotenv'
import { spawnSync } from 'child_process'

config({ path: '.env.staging', override: true })

const result = spawnSync('next', ['build'], { stdio: 'inherit', env: process.env, shell: true })
process.exit(result.status ?? 1)
