CREATE TYPE public.enum_knowledge_base_file_type AS ENUM (
  'PDF',
  'XLS',
  'DOC',
  'Folder'
);

ALTER TYPE public.enum_knowledge_base_file_type OWNER TO payload_app;