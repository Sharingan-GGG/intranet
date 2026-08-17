CREATE TABLE public.quick_links_links (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  id         character varying NOT NULL,
  label      character varying NOT NULL,
  image_id   integer,
  link       character varying NOT NULL
);

CREATE INDEX quick_links_links_image_idx ON public.quick_links_links (image_id);

CREATE INDEX quick_links_links_order_idx ON public.quick_links_links (_order);

CREATE INDEX quick_links_links_parent_id_idx ON public.quick_links_links (_parent_id);

ALTER TABLE public.quick_links_links
  OWNER TO payload_app;

ALTER TABLE public.quick_links_links
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quick_links_links
  ADD CONSTRAINT quick_links_links_image_id_media_id_fk FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.quick_links_links
  ADD CONSTRAINT quick_links_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.quick_links(id) ON DELETE CASCADE;

ALTER TABLE public.quick_links_links
  ADD CONSTRAINT quick_links_links_pkey PRIMARY KEY (id);