CREATE TABLE public.payload_kv (
  id   integer           DEFAULT nextval('public.payload_kv_id_seq'::regclass) NOT NULL,
  key  character varying NOT NULL,
  data jsonb             NOT NULL
);

CREATE UNIQUE INDEX payload_kv_key_idx ON public.payload_kv (key);

ALTER SEQUENCE public.payload_kv_id_seq OWNED BY public.payload_kv.id;

ALTER TABLE public.payload_kv
  OWNER TO payload_app;

ALTER TABLE public.payload_kv
  ADD CONSTRAINT payload_kv_pkey PRIMARY KEY (id);