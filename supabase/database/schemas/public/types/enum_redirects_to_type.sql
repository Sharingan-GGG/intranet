CREATE TYPE public.enum_redirects_to_type AS ENUM (
  'reference',
  'custom'
);

ALTER TYPE public.enum_redirects_to_type OWNER TO payload_app;