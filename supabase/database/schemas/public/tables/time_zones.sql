CREATE TABLE public.time_zones (
  id         integer                         DEFAULT nextval('public.time_zones_id_seq'::regclass) NOT NULL,
  label      character varying               NOT NULL,
  timezone   public.enum_time_zones_timezone NOT NULL,
  "order"    numeric                         DEFAULT 0,
  updated_at timestamp(3) with time zone     DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone     DEFAULT now() NOT NULL
);

CREATE INDEX time_zones_updated_at_idx ON public.time_zones (updated_at);

CREATE INDEX time_zones_created_at_idx ON public.time_zones (created_at);

ALTER SEQUENCE public.time_zones_id_seq OWNED BY public.time_zones.id;

ALTER TABLE public.time_zones
  OWNER TO payload_app;

ALTER TABLE public.time_zones
  ADD CONSTRAINT time_zones_pkey PRIMARY KEY (id);