CREATE TABLE public.header_nav_items (
  _order       integer                                NOT NULL,
  _parent_id   integer                                NOT NULL,
  id           character varying                      NOT NULL,
  link_type    public.enum_header_nav_items_link_type DEFAULT 'reference'::public.enum_header_nav_items_link_type,
  link_new_tab boolean,
  link_url     character varying,
  link_label   character varying                      NOT NULL
);

CREATE INDEX header_nav_items_order_idx ON public.header_nav_items (_order);

CREATE INDEX header_nav_items_parent_id_idx ON public.header_nav_items (_parent_id);

ALTER TABLE public.header_nav_items
  OWNER TO payload_app;

ALTER TABLE public.header_nav_items
  ADD CONSTRAINT header_nav_items_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.header(id) ON DELETE CASCADE;

ALTER TABLE public.header_nav_items
  ADD CONSTRAINT header_nav_items_pkey PRIMARY KEY (id);