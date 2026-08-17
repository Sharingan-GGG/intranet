CREATE TABLE public.categories_breadcrumbs (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  id         character varying NOT NULL,
  doc_id     integer,
  url        character varying,
  label      character varying
);

CREATE INDEX categories_breadcrumbs_parent_id_idx ON public.categories_breadcrumbs (_parent_id);

CREATE INDEX categories_breadcrumbs_order_idx ON public.categories_breadcrumbs (_order);

CREATE INDEX categories_breadcrumbs_doc_idx ON public.categories_breadcrumbs (doc_id);

ALTER TABLE public.categories_breadcrumbs
  OWNER TO payload_app;

ALTER TABLE public.categories_breadcrumbs
  ADD CONSTRAINT categories_breadcrumbs_doc_id_categories_id_fk FOREIGN KEY (doc_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.categories_breadcrumbs
  ADD CONSTRAINT categories_breadcrumbs_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.categories_breadcrumbs
  ADD CONSTRAINT categories_breadcrumbs_pkey PRIMARY KEY (id);