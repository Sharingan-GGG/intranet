CREATE TABLE public._pages_v_blocks_content_columns (
  _order          integer                                                     NOT NULL,
  _parent_id      integer                                                     NOT NULL,
  id              integer                                                     DEFAULT nextval('public._pages_v_blocks_content_columns_id_seq'::regclass) NOT NULL,
  size            public.enum__pages_v_blocks_content_columns_size            DEFAULT 'oneThird'::public.enum__pages_v_blocks_content_columns_size,
  rich_text       jsonb,
  enable_link     boolean,
  link_type       public.enum__pages_v_blocks_content_columns_link_type       DEFAULT 'reference'::public.enum__pages_v_blocks_content_columns_link_type,
  link_new_tab    boolean,
  link_url        character varying,
  link_label      character varying,
  link_appearance public.enum__pages_v_blocks_content_columns_link_appearance DEFAULT 'default'::public.enum__pages_v_blocks_content_columns_link_appearance,
  _uuid           character varying
);

CREATE INDEX _pages_v_blocks_content_columns_parent_id_idx ON public._pages_v_blocks_content_columns (_parent_id);

CREATE INDEX _pages_v_blocks_content_columns_order_idx ON public._pages_v_blocks_content_columns (_order);

ALTER SEQUENCE public._pages_v_blocks_content_columns_id_seq OWNED BY public._pages_v_blocks_content_columns.id;

ALTER TABLE public._pages_v_blocks_content_columns
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_content_columns
  ADD CONSTRAINT _pages_v_blocks_content_columns_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v_blocks_content(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_content_columns
  ADD CONSTRAINT _pages_v_blocks_content_columns_pkey PRIMARY KEY (id);