import { buildWithEnv } from './build-env.mjs'

buildWithEnv('.env.production', {
  value: 'qpnyysjakayualiqtvyf', // production Supabase project ref
  reject: 'mckqcwpnaouqrfnoxils', // staging — must never appear in a production bundle
})
