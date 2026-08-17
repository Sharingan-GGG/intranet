CREATE TABLE public.permissions_admin_collections (
  "order"   integer                                   NOT NULL,
  parent_id integer                                   NOT NULL,
  value     public.enum_permissions_admin_collections,
  id        integer                                   DEFAULT nextval('public.permissions_admin_collections_id_seq'::regclass) NOT NULL
);

CREATE INDEX permissions_admin_collections_parent_idx ON public.permissions_admin_collections (parent_id);

CREATE INDEX permissions_admin_collections_order_idx ON public.permissions_admin_collections ("order");

ALTER SEQUENCE public.permissions_admin_collections_id_seq OWNED BY public.permissions_admin_collections.id;

ALTER TABLE public.permissions_admin_collections
  OWNER TO payload_app;

ALTER TABLE public.permissions_admin_collections
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions_admin_collections
  ADD CONSTRAINT permissions_admin_collections_parent_fk FOREIGN KEY (parent_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE public.permissions_admin_collections
  ADD CONSTRAINT permissions_admin_collections_pkey PRIMARY KEY (id);