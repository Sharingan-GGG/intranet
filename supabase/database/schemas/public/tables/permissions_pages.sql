CREATE TABLE public.permissions_pages (
  "order"   integer                       NOT NULL,
  parent_id integer                       NOT NULL,
  value     public.enum_permissions_pages,
  id        integer                       DEFAULT nextval('public.permissions_pages_id_seq'::regclass) NOT NULL
);

CREATE INDEX permissions_pages_parent_idx ON public.permissions_pages (parent_id);

CREATE INDEX permissions_pages_order_idx ON public.permissions_pages ("order");

ALTER SEQUENCE public.permissions_pages_id_seq OWNED BY public.permissions_pages.id;

ALTER TABLE public.permissions_pages
  OWNER TO payload_app;

ALTER TABLE public.permissions_pages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions_pages
  ADD CONSTRAINT permissions_pages_parent_fk FOREIGN KEY (parent_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE public.permissions_pages
  ADD CONSTRAINT permissions_pages_pkey PRIMARY KEY (id);