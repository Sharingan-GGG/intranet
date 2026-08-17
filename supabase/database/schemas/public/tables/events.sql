CREATE TABLE public.events (
  id               integer                             DEFAULT nextval('public.events_id_seq'::regclass) NOT NULL,
  title            character varying                   NOT NULL,
  date             timestamp(3) with time zone         NOT NULL,
  "time"           timestamp(3) with time zone,
  is_multi_day     boolean                             DEFAULT false,
  end_date         timestamp(3) with time zone,
  repeat           public.enum_events_repeat           DEFAULT 'none'::public.enum_events_repeat,
  repeat_every     numeric                             DEFAULT 1,
  repeat_frequency public.enum_events_repeat_frequency DEFAULT 'weeks'::public.enum_events_repeat_frequency,
  location         character varying,
  description      character varying,
  slug             character varying,
  updated_at       timestamp(3) with time zone         DEFAULT now() NOT NULL,
  created_at       timestamp(3) with time zone         DEFAULT now() NOT NULL,
  button_label     character varying,
  button_url       character varying,
  category_id      integer
);

CREATE INDEX events_created_at_idx ON public.events (created_at);

CREATE INDEX events_updated_at_idx ON public.events (updated_at);

CREATE UNIQUE INDEX events_slug_idx ON public.events (slug);

CREATE INDEX events_category_idx ON public.events (category_id);

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;

ALTER TABLE public.events
  OWNER TO payload_app;

ALTER TABLE public.events
  ADD CONSTRAINT events_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.events
  ADD CONSTRAINT events_pkey PRIMARY KEY (id);