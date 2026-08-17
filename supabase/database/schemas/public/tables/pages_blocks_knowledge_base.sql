CREATE TABLE public.pages_blocks_knowledge_base (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         character varying NOT NULL,
  heading    character varying,
  block_name character varying
);

CREATE INDEX pages_blocks_knowledge_base_order_idx ON public.pages_blocks_knowledge_base (_order);

CREATE INDEX pages_blocks_knowledge_base_path_idx ON public.pages_blocks_knowledge_base (_path);

CREATE INDEX pages_blocks_knowledge_base_parent_id_idx ON public.pages_blocks_knowledge_base (_parent_id);

ALTER TABLE public.pages_blocks_knowledge_base
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_knowledge_base
  ADD CONSTRAINT pages_blocks_knowledge_base_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_knowledge_base
  ADD CONSTRAINT pages_blocks_knowledge_base_pkey PRIMARY KEY (id);