CREATE TYPE public.enum__pages_v_version_hero_type AS ENUM (
  'none',
  'highImpact',
  'mediumImpact',
  'lowImpact'
);

ALTER TYPE public.enum__pages_v_version_hero_type OWNER TO payload_app;