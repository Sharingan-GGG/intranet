CREATE TABLE public.quick_links_rels (
  id             integer           DEFAULT nextval('public.quick_links_rels_id_seq'::regclass) NOT NULL,
  "order"        integer,
  parent_id      integer           NOT NULL,
  path           character varying NOT NULL,
  departments_id character varying
);

CREATE INDEX quick_links_rels_parent_idx ON public.quick_links_rels (parent_id);

CREATE INDEX quick_links_rels_order_idx ON public.quick_links_rels ("order");

CREATE INDEX quick_links_rels_path_idx ON public.quick_links_rels (path);

ALTER SEQUENCE public.quick_links_rels_id_seq OWNED BY public.quick_links_rels.id;

ALTER TABLE public.quick_links_rels
  OWNER TO payload_app;

ALTER TABLE public.quick_links_rels
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quick_links_rels
  ADD CONSTRAINT quick_links_rels_departments_fk FOREIGN KEY (departments_id) REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.quick_links_rels
  ADD CONSTRAINT quick_links_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.quick_links(id) ON DELETE CASCADE;

ALTER TABLE public.quick_links_rels
  ADD CONSTRAINT quick_links_rels_pkey PRIMARY KEY (id);