CREATE TABLE public._pages_v_blocks_media_block (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_media_block_id_seq'::regclass) NOT NULL,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_media_block_order_idx ON public._pages_v_blocks_media_block (_order);

CREATE INDEX _pages_v_blocks_media_block_parent_id_idx ON public._pages_v_blocks_media_block (_parent_id);

CREATE INDEX _pages_v_blocks_media_block_path_idx ON public._pages_v_blocks_media_block (_path);

ALTER SEQUENCE public._pages_v_blocks_media_block_id_seq OWNED BY public._pages_v_blocks_media_block.id;

ALTER TABLE public._pages_v_blocks_media_block
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_media_block
  ADD CONSTRAINT _pages_v_blocks_media_block_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_media_block
  ADD CONSTRAINT _pages_v_blocks_media_block_pkey PRIMARY KEY (id);