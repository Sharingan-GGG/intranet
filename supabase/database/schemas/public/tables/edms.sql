CREATE TABLE public.edms (
  id          integer                     DEFAULT nextval('public.edms_id_seq'::regclass) NOT NULL,
  title       character varying           NOT NULL,
  image_id    integer,
  description character varying,
  date_sent   timestamp(3) with time zone,
  url         character varying           NOT NULL,
  updated_at  timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at  timestamp(3) with time zone DEFAULT now() NOT NULL,
  category_id integer
);

CREATE INDEX edms_category_idx ON public.edms (category_id);

CREATE INDEX edms_created_at_idx ON public.edms (created_at);

CREATE INDEX edms_image_idx ON public.edms (image_id);

CREATE INDEX edms_updated_at_idx ON public.edms (updated_at);

ALTER SEQUENCE public.edms_id_seq OWNED BY public.edms.id;

ALTER TABLE public.edms
  OWNER TO payload_app;

ALTER TABLE public.edms
  ADD CONSTRAINT edms_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.edms
  ADD CONSTRAINT edms_pkey PRIMARY KEY (id);

ALTER TABLE public.edms
  ADD CONSTRAINT edms_image_id_media_id_fk FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE SET NULL;