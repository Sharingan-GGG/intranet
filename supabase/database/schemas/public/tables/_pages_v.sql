CREATE TABLE public._pages_v (
  id                       integer                                DEFAULT nextval('public._pages_v_id_seq'::regclass) NOT NULL,
  parent_id                integer,
  version_title            character varying,
  version_hero_type        public.enum__pages_v_version_hero_type DEFAULT 'lowImpact'::public.enum__pages_v_version_hero_type,
  version_hero_rich_text   jsonb,
  version_hero_media_id    integer,
  version_meta_title       character varying,
  version_meta_image_id    integer,
  version_meta_description character varying,
  version_published_at     timestamp(3) with time zone,
  version_generate_slug    boolean                                DEFAULT true,
  version_slug             character varying,
  version_updated_at       timestamp(3) with time zone,
  version_created_at       timestamp(3) with time zone,
  version__status          public.enum__pages_v_version_status    DEFAULT 'draft'::public.enum__pages_v_version_status,
  created_at               timestamp(3) with time zone            DEFAULT now() NOT NULL,
  updated_at               timestamp(3) with time zone            DEFAULT now() NOT NULL,
  latest                   boolean,
  autosave                 boolean
);

CREATE INDEX _pages_v_version_version_slug_idx ON public._pages_v (version_slug);

CREATE INDEX _pages_v_version_version_created_at_idx ON public._pages_v (version_created_at);

CREATE INDEX _pages_v_version_version__status_idx ON public._pages_v (version__status);

CREATE INDEX _pages_v_version_version_updated_at_idx ON public._pages_v (version_updated_at);

CREATE INDEX _pages_v_version_meta_version_meta_image_idx ON public._pages_v (version_meta_image_id);

CREATE INDEX _pages_v_version_hero_version_hero_media_idx ON public._pages_v (version_hero_media_id);

CREATE INDEX _pages_v_updated_at_idx ON public._pages_v (updated_at);

CREATE INDEX _pages_v_parent_idx ON public._pages_v (parent_id);

CREATE INDEX _pages_v_latest_idx ON public._pages_v (latest);

CREATE INDEX _pages_v_created_at_idx ON public._pages_v (created_at);

CREATE INDEX _pages_v_autosave_idx ON public._pages_v (autosave);

ALTER SEQUENCE public._pages_v_id_seq OWNED BY public._pages_v.id;

ALTER TABLE public._pages_v
  OWNER TO payload_app;

ALTER TABLE public._pages_v
  ADD CONSTRAINT _pages_v_pkey PRIMARY KEY (id);

ALTER TABLE public._pages_v
  ADD CONSTRAINT _pages_v_version_hero_media_id_media_id_fk FOREIGN KEY (version_hero_media_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public._pages_v
  ADD CONSTRAINT _pages_v_version_meta_image_id_media_id_fk FOREIGN KEY (version_meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public._pages_v
  ADD CONSTRAINT _pages_v_parent_id_pages_id_fk FOREIGN KEY (parent_id) REFERENCES public.pages(id) ON DELETE SET NULL;