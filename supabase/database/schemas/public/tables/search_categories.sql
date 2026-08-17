CREATE TABLE public.search_categories (
  _order       integer           NOT NULL,
  _parent_id   integer           NOT NULL,
  id           character varying NOT NULL,
  relation_to  character varying,
  category_i_d character varying,
  title        character varying
);

CREATE INDEX search_categories_order_idx ON public.search_categories (_order);

CREATE INDEX search_categories_parent_id_idx ON public.search_categories (_parent_id);

ALTER TABLE public.search_categories
  OWNER TO payload_app;

ALTER TABLE public.search_categories
  ADD CONSTRAINT search_categories_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.search(id) ON DELETE CASCADE;

ALTER TABLE public.search_categories
  ADD CONSTRAINT search_categories_pkey PRIMARY KEY (id);