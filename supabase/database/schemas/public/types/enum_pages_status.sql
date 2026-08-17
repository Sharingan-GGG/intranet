CREATE TYPE public.enum_pages_status AS ENUM (
  'draft',
  'published'
);

ALTER TYPE public.enum_pages_status OWNER TO payload_app;