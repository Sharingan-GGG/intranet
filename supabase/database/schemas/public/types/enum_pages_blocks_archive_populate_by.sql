CREATE TYPE public.enum_pages_blocks_archive_populate_by AS ENUM (
  'collection',
  'selection'
);

ALTER TYPE public.enum_pages_blocks_archive_populate_by OWNER TO payload_app;