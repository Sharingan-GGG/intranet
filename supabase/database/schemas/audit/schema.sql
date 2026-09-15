CREATE SCHEMA audit AUTHORIZATION postgres;

-- Deliberately NOT granted to anon. The old standalone portal talked to
-- PostgREST from the browser with the anon key; the intranet port reads and
-- writes exclusively from the server (service role), so anon needs nothing.

GRANT USAGE ON SCHEMA audit TO authenticated;

GRANT USAGE ON SCHEMA audit TO service_role;

GRANT ALL ON SCHEMA audit TO payload_app;
