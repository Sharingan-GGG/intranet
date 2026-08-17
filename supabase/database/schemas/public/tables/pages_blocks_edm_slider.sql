CREATE TABLE public.pages_blocks_edm_slider (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  heading    character varying,
  "limit"    numeric           DEFAULT 12,
  block_name character varying
);

CREATE INDEX pages_blocks_edm_slider_path_idx ON public.pages_blocks_edm_slider (_path);

CREATE INDEX pages_blocks_edm_slider_order_idx ON public.pages_blocks_edm_slider (_order);

CREATE INDEX pages_blocks_edm_slider_parent_id_idx ON public.pages_blocks_edm_slider (_parent_id);

ALTER TABLE public.pages_blocks_edm_slider
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_edm_slider
  ADD CONSTRAINT pages_blocks_edm_slider_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_edm_slider
  ADD CONSTRAINT pages_blocks_edm_slider_pkey PRIMARY KEY (id);