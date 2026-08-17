CREATE TYPE public.enum_pages_hero_type AS ENUM (
  'none',
  'highImpact',
  'mediumImpact',
  'lowImpact'
);

ALTER TYPE public.enum_pages_hero_type OWNER TO payload_app;