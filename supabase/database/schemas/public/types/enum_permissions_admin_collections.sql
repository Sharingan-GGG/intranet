CREATE TYPE public.enum_permissions_admin_collections AS ENUM (
  'all',
  'pages',
  'posts',
  'media',
  'categories',
  'edms',
  'events',
  'knowledge-base',
  'quick-links',
  'time-zones',
  'departments',
  'permissions',
  'users'
);

ALTER TYPE public.enum_permissions_admin_collections OWNER TO payload_app;