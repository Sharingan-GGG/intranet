CREATE TABLE public._posts_v (
  id                       integer                             DEFAULT nextval('public._posts_v_id_seq'::regclass) NOT NULL,
  parent_id                integer,
  version_title            character varying,
  version_hero_image_id    integer,
  version_content          jsonb,
  version_meta_title       character varying,
  version_meta_image_id    integer,
  version_meta_description character varying,
  version_featured         boolean                             DEFAULT false,
  version_featured_order   numeric,
  version_published_at     timestamp(3) with time zone,
  version_generate_slug    boolean                             DEFAULT true,
  version_slug             character varying,
  version_updated_at       timestamp(3) with time zone,
  version_created_at       timestamp(3) with time zone,
  version__status          public.enum__posts_v_version_status DEFAULT 'draft'::public.enum__posts_v_version_status,
  created_at               timestamp(3) with time zone         DEFAULT now() NOT NULL,
  updated_at               timestamp(3) with time zone         DEFAULT now() NOT NULL,
  latest                   boolean,
  autosave                 boolean,
  version_expiry_date      timestamp(3) with time zone
);

CREATE INDEX _posts_v_version_version_updated_at_idx ON public._posts_v (version_updated_at);

CREATE INDEX _posts_v_autosave_idx ON public._posts_v (autosave);

CREATE INDEX _posts_v_created_at_idx ON public._posts_v (created_at);

CREATE INDEX _posts_v_latest_idx ON public._posts_v (latest);

CREATE INDEX _posts_v_parent_idx ON public._posts_v (parent_id);

CREATE INDEX _posts_v_updated_at_idx ON public._posts_v (updated_at);

CREATE INDEX _posts_v_version_meta_version_meta_image_idx ON public._posts_v (version_meta_image_id);

CREATE INDEX _posts_v_version_version__status_idx ON public._posts_v (version__status);

CREATE INDEX _posts_v_version_version_created_at_idx ON public._posts_v (version_created_at);

CREATE INDEX _posts_v_version_version_hero_image_idx ON public._posts_v (version_hero_image_id);

CREATE INDEX _posts_v_version_version_slug_idx ON public._posts_v (version_slug);

ALTER SEQUENCE public._posts_v_id_seq OWNED BY public._posts_v.id;

ALTER TABLE public._posts_v
  OWNER TO payload_app;

ALTER TABLE public._posts_v
  ADD CONSTRAINT _posts_v_pkey PRIMARY KEY (id);

ALTER TABLE public._posts_v
  ADD CONSTRAINT _posts_v_version_hero_image_id_media_id_fk FOREIGN KEY (version_hero_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public._posts_v
  ADD CONSTRAINT _posts_v_version_meta_image_id_media_id_fk FOREIGN KEY (version_meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public._posts_v
  ADD CONSTRAINT _posts_v_parent_id_posts_id_fk FOREIGN KEY (parent_id) REFERENCES public.posts(id) ON DELETE SET NULL;