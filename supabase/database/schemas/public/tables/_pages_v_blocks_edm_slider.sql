CREATE TABLE public._pages_v_blocks_edm_slider (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_edm_slider_id_seq'::regclass) NOT NULL,
  heading    character varying,
  "limit"    numeric           DEFAULT 12,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_edm_slider_parent_id_idx ON public._pages_v_blocks_edm_slider (_parent_id);

CREATE INDEX _pages_v_blocks_edm_slider_order_idx ON public._pages_v_blocks_edm_slider (_order);

CREATE INDEX _pages_v_blocks_edm_slider_path_idx ON public._pages_v_blocks_edm_slider (_path);

ALTER SEQUENCE public._pages_v_blocks_edm_slider_id_seq OWNED BY public._pages_v_blocks_edm_slider.id;

ALTER TABLE public._pages_v_blocks_edm_slider
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_edm_slider
  ADD CONSTRAINT _pages_v_blocks_edm_slider_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_edm_slider
  ADD CONSTRAINT _pages_v_blocks_edm_slider_pkey PRIMARY KEY (id);