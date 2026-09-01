import { buildWithEnv } from './build-env.mjs'

buildWithEnv('.env.staging', {
  value: 'mckqcwpnaouqrfnoxils', // staging Supabase project ref
  reject: 'qpnyysjakayualiqtvyf', // production — must never appear in a staging bundle
})
