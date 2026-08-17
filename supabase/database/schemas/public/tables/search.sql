CREATE TABLE public.search (
  id               integer                     DEFAULT nextval('public.search_id_seq'::regclass) NOT NULL,
  title            character varying,
  priority         numeric,
  slug             character varying,
  meta_title       character varying,
  meta_description character varying,
  meta_image_id    integer,
  updated_at       timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at       timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX search_created_at_idx ON public.search (created_at);

CREATE INDEX search_updated_at_idx ON public.search (updated_at);

CREATE INDEX search_meta_meta_image_idx ON public.search (meta_image_id);

CREATE INDEX search_slug_idx ON public.search (slug);

ALTER SEQUENCE public.search_id_seq OWNED BY public.search.id;

ALTER TABLE public.search
  OWNER TO payload_app;

ALTER TABLE public.search
  ADD CONSTRAINT search_meta_image_id_media_id_fk FOREIGN KEY (meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.search
  ADD CONSTRAINT search_pkey PRIMARY KEY (id);