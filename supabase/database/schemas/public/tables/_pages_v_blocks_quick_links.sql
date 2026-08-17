CREATE TABLE public._pages_v_blocks_quick_links (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_quick_links_id_seq'::regclass) NOT NULL,
  heading    character varying,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_quick_links_path_idx ON public._pages_v_blocks_quick_links (_path);

CREATE INDEX _pages_v_blocks_quick_links_parent_id_idx ON public._pages_v_blocks_quick_links (_parent_id);

CREATE INDEX _pages_v_blocks_quick_links_order_idx ON public._pages_v_blocks_quick_links (_order);

ALTER SEQUENCE public._pages_v_blocks_quick_links_id_seq OWNED BY public._pages_v_blocks_quick_links.id;

ALTER TABLE public._pages_v_blocks_quick_links
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_quick_links
  ADD CONSTRAINT _pages_v_blocks_quick_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_quick_links
  ADD CONSTRAINT _pages_v_blocks_quick_links_pkey PRIMARY KEY (id);