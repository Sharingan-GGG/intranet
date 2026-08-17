CREATE TABLE public.quick_links (
  id         integer                     DEFAULT nextval('public.quick_links_id_seq'::regclass) NOT NULL,
  "order"    numeric                     DEFAULT 0,
  updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  name       character varying           NOT NULL
);

CREATE INDEX quick_links_created_at_idx ON public.quick_links (created_at);

CREATE INDEX quick_links_updated_at_idx ON public.quick_links (updated_at);

ALTER SEQUENCE public.quick_links_id_seq OWNED BY public.quick_links.id;

ALTER TABLE public.quick_links
  OWNER TO payload_app;

ALTER TABLE public.quick_links
  ADD CONSTRAINT quick_links_pkey PRIMARY KEY (id);