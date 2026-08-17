CREATE TABLE public.pages_blocks_quick_links (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  heading    character varying,
  block_name character varying
);

CREATE INDEX pages_blocks_quick_links_path_idx ON public.pages_blocks_quick_links (_path);

CREATE INDEX pages_blocks_quick_links_parent_id_idx ON public.pages_blocks_quick_links (_parent_id);

CREATE INDEX pages_blocks_quick_links_order_idx ON public.pages_blocks_quick_links (_order);

ALTER TABLE public.pages_blocks_quick_links
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_quick_links
  ADD CONSTRAINT pages_blocks_quick_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_quick_links
  ADD CONSTRAINT pages_blocks_quick_links_pkey PRIMARY KEY (id);