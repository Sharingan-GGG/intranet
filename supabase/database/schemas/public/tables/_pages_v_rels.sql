CREATE TABLE public._pages_v_rels (
  id            integer           DEFAULT nextval('public._pages_v_rels_id_seq'::regclass) NOT NULL,
  "order"       integer,
  parent_id     integer           NOT NULL,
  path          character varying NOT NULL,
  pages_id      integer,
  posts_id      integer,
  media_id      integer,
  categories_id integer
);

CREATE INDEX _pages_v_rels_posts_id_idx ON public._pages_v_rels (posts_id);

CREATE INDEX _pages_v_rels_path_idx ON public._pages_v_rels (path);

CREATE INDEX _pages_v_rels_parent_idx ON public._pages_v_rels (parent_id);

CREATE INDEX _pages_v_rels_pages_id_idx ON public._pages_v_rels (pages_id);

CREATE INDEX _pages_v_rels_order_idx ON public._pages_v_rels ("order");

CREATE INDEX _pages_v_rels_media_id_idx ON public._pages_v_rels (media_id);

CREATE INDEX _pages_v_rels_categories_id_idx ON public._pages_v_rels (categories_id);

ALTER SEQUENCE public._pages_v_rels_id_seq OWNED BY public._pages_v_rels.id;

ALTER TABLE public._pages_v_rels
  OWNER TO payload_app;

ALTER TABLE public._pages_v_rels
  ADD CONSTRAINT _pages_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_rels
  ADD CONSTRAINT _pages_v_rels_pkey PRIMARY KEY (id);

ALTER TABLE public._pages_v_rels
  ADD CONSTRAINT _pages_v_rels_categories_fk FOREIGN KEY (categories_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_rels
  ADD CONSTRAINT _pages_v_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_rels
  ADD CONSTRAINT _pages_v_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_rels
  ADD CONSTRAINT _pages_v_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;