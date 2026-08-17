CREATE TABLE public.redirects_rels (
  id        integer           DEFAULT nextval('public.redirects_rels_id_seq'::regclass) NOT NULL,
  "order"   integer,
  parent_id integer           NOT NULL,
  path      character varying NOT NULL,
  pages_id  integer,
  posts_id  integer
);

CREATE INDEX redirects_rels_path_idx ON public.redirects_rels (path);

CREATE INDEX redirects_rels_parent_idx ON public.redirects_rels (parent_id);

CREATE INDEX redirects_rels_order_idx ON public.redirects_rels ("order");

CREATE INDEX redirects_rels_pages_id_idx ON public.redirects_rels (pages_id);

CREATE INDEX redirects_rels_posts_id_idx ON public.redirects_rels (posts_id);

ALTER SEQUENCE public.redirects_rels_id_seq OWNED BY public.redirects_rels.id;

ALTER TABLE public.redirects_rels
  OWNER TO payload_app;

ALTER TABLE public.redirects_rels
  ADD CONSTRAINT redirects_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.redirects_rels
  ADD CONSTRAINT redirects_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.redirects(id) ON DELETE CASCADE;

ALTER TABLE public.redirects_rels
  ADD CONSTRAINT redirects_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.redirects_rels
  ADD CONSTRAINT redirects_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;