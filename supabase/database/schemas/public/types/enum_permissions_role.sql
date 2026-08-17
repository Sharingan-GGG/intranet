CREATE TYPE public.enum_permissions_role AS ENUM (
  'super-admin',
  'admin',
  'user',
  'editor'
);

ALTER TYPE public.enum_permissions_role OWNER TO payload_app;