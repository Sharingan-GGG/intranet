CREATE TABLE public.payload_folders (
  id         integer                     DEFAULT nextval('public.payload_folders_id_seq'::regclass) NOT NULL,
  name       character varying           NOT NULL,
  folder_id  integer,
  updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX payload_folders_updated_at_idx ON public.payload_folders (updated_at);

CREATE INDEX payload_folders_created_at_idx ON public.payload_folders (created_at);

CREATE INDEX payload_folders_folder_idx ON public.payload_folders (folder_id);

CREATE INDEX payload_folders_name_idx ON public.payload_folders (name);

ALTER SEQUENCE public.payload_folders_id_seq OWNED BY public.payload_folders.id;

ALTER TABLE public.payload_folders
  OWNER TO payload_app;

ALTER TABLE public.payload_folders
  ADD CONSTRAINT payload_folders_pkey PRIMARY KEY (id);

ALTER TABLE public.payload_folders
  ADD CONSTRAINT payload_folders_folder_id_payload_folders_id_fk FOREIGN KEY (folder_id) REFERENCES public.payload_folders(id) ON DELETE SET NULL;