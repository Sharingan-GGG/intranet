CREATE TABLE public._pages_v_blocks_time_zones (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_time_zones_id_seq'::regclass) NOT NULL,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_time_zones_path_idx ON public._pages_v_blocks_time_zones (_path);

CREATE INDEX _pages_v_blocks_time_zones_order_idx ON public._pages_v_blocks_time_zones (_order);

CREATE INDEX _pages_v_blocks_time_zones_parent_id_idx ON public._pages_v_blocks_time_zones (_parent_id);

ALTER SEQUENCE public._pages_v_blocks_time_zones_id_seq OWNED BY public._pages_v_blocks_time_zones.id;

ALTER TABLE public._pages_v_blocks_time_zones
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_time_zones
  ADD CONSTRAINT _pages_v_blocks_time_zones_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_time_zones
  ADD CONSTRAINT _pages_v_blocks_time_zones_pkey PRIMARY KEY (id);