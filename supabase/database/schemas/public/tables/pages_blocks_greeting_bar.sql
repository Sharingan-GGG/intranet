CREATE TABLE public.pages_blocks_greeting_bar (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  block_name character varying
);

CREATE INDEX pages_blocks_greeting_bar_order_idx ON public.pages_blocks_greeting_bar (_order);

CREATE INDEX pages_blocks_greeting_bar_path_idx ON public.pages_blocks_greeting_bar (_path);

CREATE INDEX pages_blocks_greeting_bar_parent_id_idx ON public.pages_blocks_greeting_bar (_parent_id);

ALTER TABLE public.pages_blocks_greeting_bar
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_greeting_bar
  ADD CONSTRAINT pages_blocks_greeting_bar_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_greeting_bar
  ADD CONSTRAINT pages_blocks_greeting_bar_pkey PRIMARY KEY (id);