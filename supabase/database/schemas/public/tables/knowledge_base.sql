CREATE TABLE public.knowledge_base (
  id          integer                              DEFAULT nextval('public.knowledge_base_id_seq'::regclass) NOT NULL,
  title       character varying                    NOT NULL,
  description character varying,
  file_type   public.enum_knowledge_base_file_type DEFAULT 'PDF'::public.enum_knowledge_base_file_type NOT NULL,
  file_id     integer,
  updated_at  timestamp(3) with time zone          DEFAULT now() NOT NULL,
  created_at  timestamp(3) with time zone          DEFAULT now() NOT NULL,
  category_id integer
);

CREATE INDEX knowledge_base_updated_at_idx ON public.knowledge_base (updated_at);

CREATE INDEX knowledge_base_file_idx ON public.knowledge_base (file_id);

CREATE INDEX knowledge_base_created_at_idx ON public.knowledge_base (created_at);

CREATE INDEX knowledge_base_category_idx ON public.knowledge_base (category_id);

ALTER SEQUENCE public.knowledge_base_id_seq OWNED BY public.knowledge_base.id;

ALTER TABLE public.knowledge_base
  OWNER TO payload_app;

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_file_id_media_id_fk FOREIGN KEY (file_id) REFERENCES public.media(id) ON DELETE SET NULL;