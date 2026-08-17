CREATE TABLE public.posts_populated_authors (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  id         character varying NOT NULL,
  name       character varying
);

CREATE INDEX posts_populated_authors_parent_id_idx ON public.posts_populated_authors (_parent_id);

CREATE INDEX posts_populated_authors_order_idx ON public.posts_populated_authors (_order);

ALTER TABLE public.posts_populated_authors
  OWNER TO payload_app;

ALTER TABLE public.posts_populated_authors
  ADD CONSTRAINT posts_populated_authors_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.posts_populated_authors
  ADD CONSTRAINT posts_populated_authors_pkey PRIMARY KEY (id);