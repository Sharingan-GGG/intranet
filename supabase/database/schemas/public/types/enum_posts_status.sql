CREATE TYPE public.enum_posts_status AS ENUM (
  'draft',
  'published'
);

ALTER TYPE public.enum_posts_status OWNER TO payload_app;