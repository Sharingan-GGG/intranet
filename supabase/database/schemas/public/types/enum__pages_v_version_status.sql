CREATE TYPE public.enum__pages_v_version_status AS ENUM (
  'draft',
  'published'
);

ALTER TYPE public.enum__pages_v_version_status OWNER TO payload_app;