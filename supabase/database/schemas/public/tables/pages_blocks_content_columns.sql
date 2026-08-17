CREATE TABLE public.pages_blocks_content_columns (
  _order          integer                                                  NOT NULL,
  _parent_id      character varying                                        NOT NULL,
  id              character varying                                        NOT NULL,
  size            public.enum_pages_blocks_content_columns_size            DEFAULT 'oneThird'::public.enum_pages_blocks_content_columns_size,
  rich_text       jsonb,
  enable_link     boolean,
  link_type       public.enum_pages_blocks_content_columns_link_type       DEFAULT 'reference'::public.enum_pages_blocks_content_columns_link_type,
  link_new_tab    boolean,
  link_url        character varying,
  link_label      character varying,
  link_appearance public.enum_pages_blocks_content_columns_link_appearance DEFAULT 'default'::public.enum_pages_blocks_content_columns_link_appearance
);

CREATE INDEX pages_blocks_content_columns_order_idx ON public.pages_blocks_content_columns (_order);

CREATE INDEX pages_blocks_content_columns_parent_id_idx ON public.pages_blocks_content_columns (_parent_id);

ALTER TABLE public.pages_blocks_content_columns
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_content_columns
  ADD CONSTRAINT pages_blocks_content_columns_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages_blocks_content(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_content_columns
  ADD CONSTRAINT pages_blocks_content_columns_pkey PRIMARY KEY (id);