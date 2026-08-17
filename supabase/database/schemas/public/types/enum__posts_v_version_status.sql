CREATE TYPE public.enum__posts_v_version_status AS ENUM (
  'draft',
  'published'
);

ALTER TYPE public.enum__posts_v_version_status OWNER TO payload_app;