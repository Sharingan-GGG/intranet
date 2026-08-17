CREATE TYPE public.enum_payload_jobs_log_state AS ENUM (
  'failed',
  'succeeded'
);

ALTER TYPE public.enum_payload_jobs_log_state OWNER TO payload_app;