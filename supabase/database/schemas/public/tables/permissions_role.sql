CREATE TABLE public.permissions_role (
  "order"   integer                      NOT NULL,
  parent_id integer                      NOT NULL,
  value     public.enum_permissions_role,
  id        integer                      DEFAULT nextval('public.permissions_role_id_seq'::regclass) NOT NULL
);

CREATE INDEX permissions_role_parent_idx ON public.permissions_role (parent_id);

CREATE INDEX permissions_role_order_idx ON public.permissions_role ("order");

ALTER SEQUENCE public.permissions_role_id_seq OWNED BY public.permissions_role.id;

ALTER TABLE public.permissions_role
  OWNER TO payload_app;

ALTER TABLE public.permissions_role
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions_role
  ADD CONSTRAINT permissions_role_parent_fk FOREIGN KEY (parent_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE public.permissions_role
  ADD CONSTRAINT permissions_role_pkey PRIMARY KEY (id);