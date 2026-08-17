CREATE TABLE public.users_rels (
  id        integer           DEFAULT nextval('public.users_rels_id_seq'::regclass) NOT NULL,
  "order"   integer,
  parent_id character varying NOT NULL,
  path      character varying NOT NULL
);

CREATE INDEX users_rels_parent_idx ON public.users_rels (parent_id);

CREATE INDEX users_rels_order_idx ON public.users_rels ("order");

CREATE INDEX users_rels_path_idx ON public.users_rels (path);

ALTER SEQUENCE public.users_rels_id_seq OWNED BY public.users_rels.id;

ALTER TABLE public.users_rels
  OWNER TO payload_app;

ALTER TABLE public.users_rels
  ADD CONSTRAINT users_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.users_rels
  ADD CONSTRAINT users_rels_pkey PRIMARY KEY (id);