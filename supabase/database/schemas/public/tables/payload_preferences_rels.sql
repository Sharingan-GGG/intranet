CREATE TABLE public.payload_preferences_rels (
  id        integer           DEFAULT nextval('public.payload_preferences_rels_id_seq'::regclass) NOT NULL,
  "order"   integer,
  parent_id integer           NOT NULL,
  path      character varying NOT NULL,
  users_id  character varying
);

CREATE INDEX payload_preferences_rels_users_id_idx ON public.payload_preferences_rels (users_id);

CREATE INDEX payload_preferences_rels_path_idx ON public.payload_preferences_rels (path);

CREATE INDEX payload_preferences_rels_parent_idx ON public.payload_preferences_rels (parent_id);

CREATE INDEX payload_preferences_rels_order_idx ON public.payload_preferences_rels ("order");

ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNED BY public.payload_preferences_rels.id;

ALTER TABLE public.payload_preferences_rels
  OWNER TO payload_app;

ALTER TABLE public.payload_preferences_rels
  ADD CONSTRAINT payload_preferences_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_preferences(id) ON DELETE CASCADE;

ALTER TABLE public.payload_preferences_rels
  ADD CONSTRAINT payload_preferences_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.payload_preferences_rels
  ADD CONSTRAINT payload_preferences_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;