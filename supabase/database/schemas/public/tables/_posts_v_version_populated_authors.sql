CREATE TABLE public._posts_v_version_populated_authors (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  id         integer           DEFAULT nextval('public._posts_v_version_populated_authors_id_seq'::regclass) NOT NULL,
  _uuid      character varying,
  name       character varying
);

CREATE INDEX _posts_v_version_populated_authors_parent_id_idx ON public._posts_v_version_populated_authors (_parent_id);

CREATE INDEX _posts_v_version_populated_authors_order_idx ON public._posts_v_version_populated_authors (_order);

ALTER SEQUENCE public._posts_v_version_populated_authors_id_seq OWNED BY public._posts_v_version_populated_authors.id;

ALTER TABLE public._posts_v_version_populated_authors
  OWNER TO payload_app;

ALTER TABLE public._posts_v_version_populated_authors
  ADD CONSTRAINT _posts_v_version_populated_authors_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._posts_v(id) ON DELETE CASCADE;

ALTER TABLE public._posts_v_version_populated_authors
  ADD CONSTRAINT _posts_v_version_populated_authors_pkey PRIMARY KEY (id);