-- Security Quiz (/security-quiz). Idempotent: safe on a fresh database and on
-- one that already has the schema from the standalone repo's migration.
CREATE SCHEMA IF NOT EXISTS cybersecurity_quiz AUTHORIZATION postgres;

COMMENT ON SCHEMA cybersecurity_quiz IS
  'Staff cybersecurity quiz: attempts and start markers. User details live in public.users.';

-- payload_app is the role the intranet server connects as (src/lib/quiz/backend.ts).
-- It owns the tables below, so it reads and writes them without RLS getting in the way.
-- CREATE as well as USAGE: Postgres only lets a role own a table in a schema it can create in
-- (same grant as the audit schema).
GRANT USAGE, CREATE ON SCHEMA cybersecurity_quiz TO payload_app;

-- authenticated keeps read-only access to its OWN rows through RLS (unused by the app,
-- which never queries from the browser). anon gets nothing.
GRANT USAGE ON SCHEMA cybersecurity_quiz TO authenticated;
