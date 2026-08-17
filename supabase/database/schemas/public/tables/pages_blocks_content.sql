CREATE TABLE public.pages_blocks_content (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  block_name character varying
);

CREATE INDEX pages_blocks_content_order_idx ON public.pages_blocks_content (_order);

CREATE INDEX pages_blocks_content_path_idx ON public.pages_blocks_content (_path);

CREATE INDEX pages_blocks_content_parent_id_idx ON public.pages_blocks_content (_parent_id);

ALTER TABLE public.pages_blocks_content
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_content
  ADD CONSTRAINT pages_blocks_content_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_content
  ADD CONSTRAINT pages_blocks_content_pkey PRIMARY KEY (id);