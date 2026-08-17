CREATE TABLE public.header (
  id         integer                     DEFAULT nextval('public.header_id_seq'::regclass) NOT NULL,
  updated_at timestamp(3) with time zone,
  created_at timestamp(3) with time zone
);

ALTER SEQUENCE public.header_id_seq OWNED BY public.header.id;

ALTER TABLE public.header
  OWNER TO payload_app;

ALTER TABLE public.header
  ADD CONSTRAINT header_pkey PRIMARY KEY (id);