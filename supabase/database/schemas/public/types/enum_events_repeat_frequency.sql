CREATE TYPE public.enum_events_repeat_frequency AS ENUM (
  'days',
  'weeks',
  'months',
  'years'
);

ALTER TYPE public.enum_events_repeat_frequency OWNER TO payload_app;