CREATE TABLE public.pages (
  id               integer                     DEFAULT nextval('public.pages_id_seq'::regclass) NOT NULL,
  title            character varying,
  hero_type        public.enum_pages_hero_type DEFAULT 'lowImpact'::public.enum_pages_hero_type,
  hero_rich_text   jsonb,
  hero_media_id    integer,
  meta_title       character varying,
  meta_image_id    integer,
  meta_description character varying,
  published_at     timestamp(3) with time zone,
  generate_slug    boolean                     DEFAULT true,
  slug             character varying,
  updated_at       timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at       timestamp(3) with time zone DEFAULT now() NOT NULL,
  _status          public.enum_pages_status    DEFAULT 'draft'::public.enum_pages_status
);

CREATE INDEX pages__status_idx ON public.pages (_status);

CREATE INDEX pages_created_at_idx ON public.pages (created_at);

CREATE INDEX pages_hero_hero_media_idx ON public.pages (hero_media_id);

CREATE INDEX pages_meta_meta_image_idx ON public.pages (meta_image_id);

CREATE UNIQUE INDEX pages_slug_idx ON public.pages (slug);

CREATE INDEX pages_updated_at_idx ON public.pages (updated_at);

ALTER SEQUENCE public.pages_id_seq OWNED BY public.pages.id;

ALTER TABLE public.pages
  OWNER TO payload_app;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_hero_media_id_media_id_fk FOREIGN KEY (hero_media_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_meta_image_id_media_id_fk FOREIGN KEY (meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_pkey PRIMARY KEY (id);