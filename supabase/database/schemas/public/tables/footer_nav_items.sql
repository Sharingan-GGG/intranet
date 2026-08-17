CREATE TABLE public.footer_nav_items (
  _order       integer                                NOT NULL,
  _parent_id   integer                                NOT NULL,
  id           character varying                      NOT NULL,
  link_type    public.enum_footer_nav_items_link_type DEFAULT 'reference'::public.enum_footer_nav_items_link_type,
  link_new_tab boolean,
  link_url     character varying,
  link_label   character varying                      NOT NULL
);

CREATE INDEX footer_nav_items_parent_id_idx ON public.footer_nav_items (_parent_id);

CREATE INDEX footer_nav_items_order_idx ON public.footer_nav_items (_order);

ALTER TABLE public.footer_nav_items
  OWNER TO payload_app;

ALTER TABLE public.footer_nav_items
  ADD CONSTRAINT footer_nav_items_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.footer(id) ON DELETE CASCADE;

ALTER TABLE public.footer_nav_items
  ADD CONSTRAINT footer_nav_items_pkey PRIMARY KEY (id);