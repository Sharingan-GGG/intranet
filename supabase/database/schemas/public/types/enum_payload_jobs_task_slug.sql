CREATE TYPE public.enum_payload_jobs_task_slug AS ENUM (
  'inline',
  'schedulePublish'
);

ALTER TYPE public.enum_payload_jobs_task_slug OWNER TO payload_app;