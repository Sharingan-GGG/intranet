CREATE SCHEMA pre_departure AUTHORIZATION postgres;

GRANT USAGE ON SCHEMA pre_departure TO anon;

GRANT USAGE ON SCHEMA pre_departure TO authenticated;

GRANT USAGE ON SCHEMA pre_departure TO service_role;

GRANT ALL ON SCHEMA pre_departure TO payload_app;