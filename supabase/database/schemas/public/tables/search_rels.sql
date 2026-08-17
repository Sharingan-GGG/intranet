CREATE TABLE public.search_rels (
  id        integer           DEFAULT nextval('public.search_rels_id_seq'::regclass) NOT NULL,
  "order"   integer,
  parent_id integer           NOT NULL,
  path      character varying NOT NULL,
  posts_id  integer
);

CREATE INDEX search_rels_posts_id_idx ON public.search_rels (posts_id);

CREATE INDEX search_rels_order_idx ON public.search_rels ("order");

CREATE INDEX search_rels_parent_idx ON public.search_rels (parent_id);

CREATE INDEX search_rels_path_idx ON public.search_rels (path);

ALTER SEQUENCE public.search_rels_id_seq OWNED BY public.search_rels.id;

ALTER TABLE public.search_rels
  OWNER TO payload_app;

ALTER TABLE public.search_rels
  ADD CONSTRAINT search_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.search(id) ON DELETE CASCADE;

ALTER TABLE public.search_rels
  ADD CONSTRAINT search_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.search_rels
  ADD CONSTRAINT search_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;