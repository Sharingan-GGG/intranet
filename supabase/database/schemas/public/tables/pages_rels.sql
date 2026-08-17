CREATE TABLE public.pages_rels (
  id            integer           DEFAULT nextval('public.pages_rels_id_seq'::regclass) NOT NULL,
  "order"       integer,
  parent_id     integer           NOT NULL,
  path          character varying NOT NULL,
  pages_id      integer,
  posts_id      integer,
  media_id      integer,
  categories_id integer
);

CREATE INDEX pages_rels_categories_id_idx ON public.pages_rels (categories_id);

CREATE INDEX pages_rels_posts_id_idx ON public.pages_rels (posts_id);

CREATE INDEX pages_rels_path_idx ON public.pages_rels (path);

CREATE INDEX pages_rels_parent_idx ON public.pages_rels (parent_id);

CREATE INDEX pages_rels_pages_id_idx ON public.pages_rels (pages_id);

CREATE INDEX pages_rels_media_id_idx ON public.pages_rels (media_id);

CREATE INDEX pages_rels_order_idx ON public.pages_rels ("order");

ALTER SEQUENCE public.pages_rels_id_seq OWNED BY public.pages_rels.id;

ALTER TABLE public.pages_rels
  OWNER TO payload_app;

ALTER TABLE public.pages_rels
  ADD CONSTRAINT pages_rels_categories_fk FOREIGN KEY (categories_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.pages_rels
  ADD CONSTRAINT pages_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;

ALTER TABLE public.pages_rels
  ADD CONSTRAINT pages_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_rels
  ADD CONSTRAINT pages_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_rels
  ADD CONSTRAINT pages_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.pages_rels
  ADD CONSTRAINT pages_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;