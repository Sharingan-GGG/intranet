CREATE TABLE public.users_roles (
  "order"   integer                 NOT NULL,
  parent_id character varying       NOT NULL,
  value     public.enum_users_roles,
  id        integer                 DEFAULT nextval('public.users_roles_id_seq'::regclass) NOT NULL
);

CREATE INDEX users_roles_order_idx ON public.users_roles ("order");

CREATE INDEX users_roles_parent_idx ON public.users_roles (parent_id);

ALTER SEQUENCE public.users_roles_id_seq OWNED BY public.users_roles.id;

ALTER TABLE public.users_roles
  OWNER TO payload_app;

ALTER TABLE public.users_roles
  ADD CONSTRAINT users_roles_parent_fk FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.users_roles
  ADD CONSTRAINT users_roles_pkey PRIMARY KEY (id);