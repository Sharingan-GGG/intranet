CREATE TABLE public._pages_v_blocks_featured_spotlight (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_featured_spotlight_id_seq'::regclass) NOT NULL,
  "limit"    numeric           DEFAULT 3,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_featured_spotlight_path_idx ON public._pages_v_blocks_featured_spotlight (_path);

CREATE INDEX _pages_v_blocks_featured_spotlight_order_idx ON public._pages_v_blocks_featured_spotlight (_order);

CREATE INDEX _pages_v_blocks_featured_spotlight_parent_id_idx ON public._pages_v_blocks_featured_spotlight (_parent_id);

ALTER SEQUENCE public._pages_v_blocks_featured_spotlight_id_seq OWNED BY public._pages_v_blocks_featured_spotlight.id;

ALTER TABLE public._pages_v_blocks_featured_spotlight
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_featured_spotlight
  ADD CONSTRAINT _pages_v_blocks_featured_spotlight_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_featured_spotlight
  ADD CONSTRAINT _pages_v_blocks_featured_spotlight_pkey PRIMARY KEY (id);