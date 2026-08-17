CREATE TABLE public.categories (
  id            integer                     DEFAULT nextval('public.categories_id_seq'::regclass) NOT NULL,
  title         character varying           NOT NULL,
  parent_id     integer,
  "order"       numeric                     DEFAULT 1,
  generate_slug boolean                     DEFAULT true,
  slug          character varying           NOT NULL,
  updated_at    timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at    timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX categories_updated_at_idx ON public.categories (updated_at);

CREATE INDEX categories_created_at_idx ON public.categories (created_at);

CREATE INDEX categories_parent_idx ON public.categories (parent_id);

CREATE UNIQUE INDEX categories_slug_idx ON public.categories (slug);

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;

ALTER TABLE public.categories
  OWNER TO payload_app;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE public.categories
  ADD CONSTRAINT categories_parent_id_categories_id_fk FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;