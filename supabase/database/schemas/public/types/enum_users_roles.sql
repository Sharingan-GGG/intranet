CREATE TYPE public.enum_users_roles AS ENUM (
  'super-admin',
  'admin',
  'editor',
  'user'
);

ALTER TYPE public.enum_users_roles OWNER TO payload_app;