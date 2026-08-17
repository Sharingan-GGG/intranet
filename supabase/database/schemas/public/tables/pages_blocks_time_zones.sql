CREATE TABLE public.pages_blocks_time_zones (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  block_name character varying
);

CREATE INDEX pages_blocks_time_zones_path_idx ON public.pages_blocks_time_zones (_path);

CREATE INDEX pages_blocks_time_zones_parent_id_idx ON public.pages_blocks_time_zones (_parent_id);

CREATE INDEX pages_blocks_time_zones_order_idx ON public.pages_blocks_time_zones (_order);

ALTER TABLE public.pages_blocks_time_zones
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_time_zones
  ADD CONSTRAINT pages_blocks_time_zones_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_time_zones
  ADD CONSTRAINT pages_blocks_time_zones_pkey PRIMARY KEY (id);