CREATE TABLE public.payload_folders_folder_type (
  "order"   integer                                 NOT NULL,
  parent_id integer                                 NOT NULL,
  value     public.enum_payload_folders_folder_type,
  id        integer                                 DEFAULT nextval('public.payload_folders_folder_type_id_seq'::regclass) NOT NULL
);

CREATE INDEX payload_folders_folder_type_parent_idx ON public.payload_folders_folder_type (parent_id);

CREATE INDEX payload_folders_folder_type_order_idx ON public.payload_folders_folder_type ("order");

ALTER SEQUENCE public.payload_folders_folder_type_id_seq OWNED BY public.payload_folders_folder_type.id;

ALTER TABLE public.payload_folders_folder_type
  OWNER TO payload_app;

ALTER TABLE public.payload_folders_folder_type
  ADD CONSTRAINT payload_folders_folder_type_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_folders(id) ON DELETE CASCADE;

ALTER TABLE public.payload_folders_folder_type
  ADD CONSTRAINT payload_folders_folder_type_pkey PRIMARY KEY (id);