CREATE TYPE public.enum_pages_blocks_content_columns_link_type AS ENUM (
  'reference',
  'custom'
);

ALTER TYPE public.enum_pages_blocks_content_columns_link_type OWNER TO payload_app;