CREATE TABLE public.knowledge_base_links (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  id         character varying NOT NULL,
  label      character varying,
  url        character varying
);

CREATE INDEX knowledge_base_links_parent_id_idx ON public.knowledge_base_links (_parent_id);

CREATE INDEX knowledge_base_links_order_idx ON public.knowledge_base_links (_order);

ALTER TABLE public.knowledge_base_links
  OWNER TO payload_app;

ALTER TABLE public.knowledge_base_links
  ADD CONSTRAINT knowledge_base_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.knowledge_base(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_base_links
  ADD CONSTRAINT knowledge_base_links_pkey PRIMARY KEY (id);