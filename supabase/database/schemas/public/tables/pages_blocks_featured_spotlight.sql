CREATE TABLE public.pages_blocks_featured_spotlight (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  "limit"    numeric           DEFAULT 3,
  block_name character varying
);

CREATE INDEX pages_blocks_featured_spotlight_order_idx ON public.pages_blocks_featured_spotlight (_order);

CREATE INDEX pages_blocks_featured_spotlight_path_idx ON public.pages_blocks_featured_spotlight (_path);

CREATE INDEX pages_blocks_featured_spotlight_parent_id_idx ON public.pages_blocks_featured_spotlight (_parent_id);

ALTER TABLE public.pages_blocks_featured_spotlight
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_featured_spotlight
  ADD CONSTRAINT pages_blocks_featured_spotlight_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_featured_spotlight
  ADD CONSTRAINT pages_blocks_featured_spotlight_pkey PRIMARY KEY (id);