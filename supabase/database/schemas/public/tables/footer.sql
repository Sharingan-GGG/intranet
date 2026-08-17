CREATE TABLE public.footer (
  id         integer                     DEFAULT nextval('public.footer_id_seq'::regclass) NOT NULL,
  updated_at timestamp(3) with time zone,
  created_at timestamp(3) with time zone
);

ALTER SEQUENCE public.footer_id_seq OWNED BY public.footer.id;

ALTER TABLE public.footer
  OWNER TO payload_app;

ALTER TABLE public.footer
  ADD CONSTRAINT footer_pkey PRIMARY KEY (id);