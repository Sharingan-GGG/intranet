CREATE TABLE public.redirects (
  id         integer                       DEFAULT nextval('public.redirects_id_seq'::regclass) NOT NULL,
  "from"     character varying             NOT NULL,
  to_type    public.enum_redirects_to_type DEFAULT 'reference'::public.enum_redirects_to_type,
  to_url     character varying,
  updated_at timestamp(3) with time zone   DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone   DEFAULT now() NOT NULL
);

CREATE INDEX redirects_updated_at_idx ON public.redirects (updated_at);

CREATE UNIQUE INDEX redirects_from_idx ON public.redirects ("from");

CREATE INDEX redirects_created_at_idx ON public.redirects (created_at);

ALTER SEQUENCE public.redirects_id_seq OWNED BY public.redirects.id;

ALTER TABLE public.redirects
  OWNER TO payload_app;

ALTER TABLE public.redirects
  ADD CONSTRAINT redirects_pkey PRIMARY KEY (id);