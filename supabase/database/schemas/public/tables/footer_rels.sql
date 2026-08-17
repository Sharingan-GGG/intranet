CREATE TABLE public.footer_rels (
  id        integer           DEFAULT nextval('public.footer_rels_id_seq'::regclass) NOT NULL,
  "order"   integer,
  parent_id integer           NOT NULL,
  path      character varying NOT NULL,
  pages_id  integer,
  posts_id  integer
);

CREATE INDEX footer_rels_posts_id_idx ON public.footer_rels (posts_id);

CREATE INDEX footer_rels_parent_idx ON public.footer_rels (parent_id);

CREATE INDEX footer_rels_pages_id_idx ON public.footer_rels (pages_id);

CREATE INDEX footer_rels_order_idx ON public.footer_rels ("order");

CREATE INDEX footer_rels_path_idx ON public.footer_rels (path);

ALTER SEQUENCE public.footer_rels_id_seq OWNED BY public.footer_rels.id;

ALTER TABLE public.footer_rels
  OWNER TO payload_app;

ALTER TABLE public.footer_rels
  ADD CONSTRAINT footer_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.footer(id) ON DELETE CASCADE;

ALTER TABLE public.footer_rels
  ADD CONSTRAINT footer_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.footer_rels
  ADD CONSTRAINT footer_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.footer_rels
  ADD CONSTRAINT footer_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;