CREATE TYPE public.enum_events_repeat AS ENUM (
  'none',
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'biannually',
  'annually',
  'custom'
);

ALTER TYPE public.enum_events_repeat OWNER TO payload_app;