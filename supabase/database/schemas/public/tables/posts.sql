CREATE TABLE public.posts (
  id               integer                     DEFAULT nextval('public.posts_id_seq'::regclass) NOT NULL,
  title            character varying,
  hero_image_id    integer,
  content          jsonb,
  meta_title       character varying,
  meta_image_id    integer,
  meta_description character varying,
  featured         boolean                     DEFAULT false,
  featured_order   numeric,
  published_at     timestamp(3) with time zone,
  generate_slug    boolean                     DEFAULT true,
  slug             character varying,
  updated_at       timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at       timestamp(3) with time zone DEFAULT now() NOT NULL,
  _status          public.enum_posts_status    DEFAULT 'draft'::public.enum_posts_status,
  expiry_date      timestamp(3) with time zone
);

CREATE INDEX posts_meta_meta_image_idx ON public.posts (meta_image_id);

CREATE INDEX posts_updated_at_idx ON public.posts (updated_at);

CREATE INDEX posts_created_at_idx ON public.posts (created_at);

CREATE INDEX posts_hero_image_idx ON public.posts (hero_image_id);

CREATE UNIQUE INDEX posts_slug_idx ON public.posts (slug);

CREATE INDEX posts__status_idx ON public.posts (_status);

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;

ALTER TABLE public.posts
  OWNER TO payload_app;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_hero_image_id_media_id_fk FOREIGN KEY (hero_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_meta_image_id_media_id_fk FOREIGN KEY (meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_pkey PRIMARY KEY (id);