CREATE TABLE public.pages_blocks_cta (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  rich_text  jsonb,
  block_name character varying
);

CREATE INDEX pages_blocks_cta_parent_id_idx ON public.pages_blocks_cta (_parent_id);

CREATE INDEX pages_blocks_cta_path_idx ON public.pages_blocks_cta (_path);

CREATE INDEX pages_blocks_cta_order_idx ON public.pages_blocks_cta (_order);

ALTER TABLE public.pages_blocks_cta
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_cta
  ADD CONSTRAINT pages_blocks_cta_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_cta
  ADD CONSTRAINT pages_blocks_cta_pkey PRIMARY KEY (id);