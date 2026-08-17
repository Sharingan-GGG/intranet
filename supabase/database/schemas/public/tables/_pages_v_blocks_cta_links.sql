CREATE TABLE public._pages_v_blocks_cta_links (
  _order          integer                                               NOT NULL,
  _parent_id      integer                                               NOT NULL,
  id              integer                                               DEFAULT nextval('public._pages_v_blocks_cta_links_id_seq'::regclass) NOT NULL,
  link_type       public.enum__pages_v_blocks_cta_links_link_type       DEFAULT 'reference'::public.enum__pages_v_blocks_cta_links_link_type,
  link_new_tab    boolean,
  link_url        character varying,
  link_label      character varying,
  link_appearance public.enum__pages_v_blocks_cta_links_link_appearance DEFAULT 'default'::public.enum__pages_v_blocks_cta_links_link_appearance,
  _uuid           character varying
);

CREATE INDEX _pages_v_blocks_cta_links_order_idx ON public._pages_v_blocks_cta_links (_order);

CREATE INDEX _pages_v_blocks_cta_links_parent_id_idx ON public._pages_v_blocks_cta_links (_parent_id);

ALTER SEQUENCE public._pages_v_blocks_cta_links_id_seq OWNED BY public._pages_v_blocks_cta_links.id;

ALTER TABLE public._pages_v_blocks_cta_links
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_cta_links
  ADD CONSTRAINT _pages_v_blocks_cta_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v_blocks_cta(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_cta_links
  ADD CONSTRAINT _pages_v_blocks_cta_links_pkey PRIMARY KEY (id);