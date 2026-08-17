CREATE TYPE public.enum_header_nav_items_link_type AS ENUM (
  'reference',
  'custom'
);

ALTER TYPE public.enum_header_nav_items_link_type OWNER TO payload_app;