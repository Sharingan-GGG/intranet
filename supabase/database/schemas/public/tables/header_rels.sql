CREATE TABLE public.header_rels (
  id        integer           DEFAULT nextval('public.header_rels_id_seq'::regclass) NOT NULL,
  "order"   integer,
  parent_id integer           NOT NULL,
  path      character varying NOT NULL,
  pages_id  integer,
  posts_id  integer
);

CREATE INDEX header_rels_order_idx ON public.header_rels ("order");

CREATE INDEX header_rels_pages_id_idx ON public.header_rels (pages_id);

CREATE INDEX header_rels_posts_id_idx ON public.header_rels (posts_id);

CREATE INDEX header_rels_path_idx ON public.header_rels (path);

CREATE INDEX header_rels_parent_idx ON public.header_rels (parent_id);

ALTER SEQUENCE public.header_rels_id_seq OWNED BY public.header_rels.id;

ALTER TABLE public.header_rels
  OWNER TO payload_app;

ALTER TABLE public.header_rels
  ADD CONSTRAINT header_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.header(id) ON DELETE CASCADE;

ALTER TABLE public.header_rels
  ADD CONSTRAINT header_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.header_rels
  ADD CONSTRAINT header_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.header_rels
  ADD CONSTRAINT header_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;