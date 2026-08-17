CREATE TABLE public.pages_blocks_cta_links (
  _order          integer                                            NOT NULL,
  _parent_id      character varying                                  NOT NULL,
  id              character varying                                  NOT NULL,
  link_type       public.enum_pages_blocks_cta_links_link_type       DEFAULT 'reference'::public.enum_pages_blocks_cta_links_link_type,
  link_new_tab    boolean,
  link_url        character varying,
  link_label      character varying,
  link_appearance public.enum_pages_blocks_cta_links_link_appearance DEFAULT 'default'::public.enum_pages_blocks_cta_links_link_appearance
);

CREATE INDEX pages_blocks_cta_links_parent_id_idx ON public.pages_blocks_cta_links (_parent_id);

CREATE INDEX pages_blocks_cta_links_order_idx ON public.pages_blocks_cta_links (_order);

ALTER TABLE public.pages_blocks_cta_links
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_cta_links
  ADD CONSTRAINT pages_blocks_cta_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages_blocks_cta(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_cta_links
  ADD CONSTRAINT pages_blocks_cta_links_pkey PRIMARY KEY (id);