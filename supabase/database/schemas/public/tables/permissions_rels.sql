CREATE TABLE public.permissions_rels (
  id             integer           DEFAULT nextval('public.permissions_rels_id_seq'::regclass) NOT NULL,
  "order"        integer,
  parent_id      integer           NOT NULL,
  path           character varying NOT NULL,
  departments_id character varying
);

CREATE INDEX permissions_rels_parent_idx ON public.permissions_rels (parent_id);

CREATE INDEX permissions_rels_path_idx ON public.permissions_rels (path);

CREATE INDEX permissions_rels_order_idx ON public.permissions_rels ("order");

ALTER SEQUENCE public.permissions_rels_id_seq OWNED BY public.permissions_rels.id;

ALTER TABLE public.permissions_rels
  OWNER TO payload_app;

ALTER TABLE public.permissions_rels
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions_rels
  ADD CONSTRAINT permissions_rels_departments_fk FOREIGN KEY (departments_id) REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.permissions_rels
  ADD CONSTRAINT permissions_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE public.permissions_rels
  ADD CONSTRAINT permissions_rels_pkey PRIMARY KEY (id);