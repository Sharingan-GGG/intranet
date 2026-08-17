CREATE TABLE public.payload_preferences (
  id         integer                     DEFAULT nextval('public.payload_preferences_id_seq'::regclass) NOT NULL,
  key        character varying,
  value      jsonb,
  updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX payload_preferences_created_at_idx ON public.payload_preferences (created_at);

CREATE INDEX payload_preferences_updated_at_idx ON public.payload_preferences (updated_at);

CREATE INDEX payload_preferences_key_idx ON public.payload_preferences (key);

ALTER SEQUENCE public.payload_preferences_id_seq OWNED BY public.payload_preferences.id;

ALTER TABLE public.payload_preferences
  OWNER TO payload_app;

ALTER TABLE public.payload_preferences
  ADD CONSTRAINT payload_preferences_pkey PRIMARY KEY (id);