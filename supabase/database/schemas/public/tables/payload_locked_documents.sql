CREATE TABLE public.payload_locked_documents (
  id          integer                     DEFAULT nextval('public.payload_locked_documents_id_seq'::regclass) NOT NULL,
  global_slug character varying,
  updated_at  timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at  timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX payload_locked_documents_created_at_idx ON public.payload_locked_documents (created_at);

CREATE INDEX payload_locked_documents_global_slug_idx ON public.payload_locked_documents (global_slug);

CREATE INDEX payload_locked_documents_updated_at_idx ON public.payload_locked_documents (updated_at);

ALTER SEQUENCE public.payload_locked_documents_id_seq OWNED BY public.payload_locked_documents.id;

ALTER TABLE public.payload_locked_documents
  OWNER TO payload_app;

ALTER TABLE public.payload_locked_documents
  ADD CONSTRAINT payload_locked_documents_pkey PRIMARY KEY (id);