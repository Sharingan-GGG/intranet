CREATE TABLE public.payload_migrations (
  id         integer                     DEFAULT nextval('public.payload_migrations_id_seq'::regclass) NOT NULL,
  name       character varying,
  batch      numeric,
  updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX payload_migrations_updated_at_idx ON public.payload_migrations (updated_at);

CREATE INDEX payload_migrations_created_at_idx ON public.payload_migrations (created_at);

ALTER SEQUENCE public.payload_migrations_id_seq OWNED BY public.payload_migrations.id;

ALTER TABLE public.payload_migrations
  OWNER TO payload_app;

ALTER TABLE public.payload_migrations
  ADD CONSTRAINT payload_migrations_pkey PRIMARY KEY (id);