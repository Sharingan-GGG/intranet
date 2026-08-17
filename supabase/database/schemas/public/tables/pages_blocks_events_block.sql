CREATE TABLE public.pages_blocks_events_block (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  heading    character varying,
  block_name character varying
);

CREATE INDEX pages_blocks_events_block_parent_id_idx ON public.pages_blocks_events_block (_parent_id);

CREATE INDEX pages_blocks_events_block_path_idx ON public.pages_blocks_events_block (_path);

CREATE INDEX pages_blocks_events_block_order_idx ON public.pages_blocks_events_block (_order);

ALTER TABLE public.pages_blocks_events_block
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_events_block
  ADD CONSTRAINT pages_blocks_events_block_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_events_block
  ADD CONSTRAINT pages_blocks_events_block_pkey PRIMARY KEY (id);