CREATE TABLE public.pages_hero_links (
  _order          integer                                      NOT NULL,
  _parent_id      integer                                      NOT NULL,
  id              character varying                            NOT NULL,
  link_type       public.enum_pages_hero_links_link_type       DEFAULT 'reference'::public.enum_pages_hero_links_link_type,
  link_new_tab    boolean,
  link_url        character varying,
  link_label      character varying,
  link_appearance public.enum_pages_hero_links_link_appearance DEFAULT 'default'::public.enum_pages_hero_links_link_appearance
);

CREATE INDEX pages_hero_links_parent_id_idx ON public.pages_hero_links (_parent_id);

CREATE INDEX pages_hero_links_order_idx ON public.pages_hero_links (_order);

ALTER TABLE public.pages_hero_links
  OWNER TO payload_app;

ALTER TABLE public.pages_hero_links
  ADD CONSTRAINT pages_hero_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_hero_links
  ADD CONSTRAINT pages_hero_links_pkey PRIMARY KEY (id);