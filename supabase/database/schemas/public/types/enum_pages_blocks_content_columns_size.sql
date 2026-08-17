CREATE TYPE public.enum_pages_blocks_content_columns_size AS ENUM (
  'oneThird',
  'half',
  'twoThirds',
  'full'
);

ALTER TYPE public.enum_pages_blocks_content_columns_size OWNER TO payload_app;