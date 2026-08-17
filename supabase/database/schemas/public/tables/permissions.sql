CREATE TABLE public.permissions (
  id          integer                     DEFAULT nextval('public.permissions_id_seq'::regclass) NOT NULL,
  name        character varying           NOT NULL,
  category    character varying,
  description character varying,
  updated_at  timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at  timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX permissions_updated_at_idx ON public.permissions (updated_at);

CREATE INDEX permissions_created_at_idx ON public.permissions (created_at);

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;

ALTER TABLE public.permissions
  OWNER TO payload_app;

ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);