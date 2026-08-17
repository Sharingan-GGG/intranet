CREATE TABLE public._pages_v_blocks_archive (
  _order        integer                                         NOT NULL,
  _parent_id    integer                                         NOT NULL,
  _path         text                                            NOT NULL,
  id            integer                                         DEFAULT nextval('public._pages_v_blocks_archive_id_seq'::regclass) NOT NULL,
  intro_content jsonb,
  populate_by   public.enum__pages_v_blocks_archive_populate_by DEFAULT 'collection'::public.enum__pages_v_blocks_archive_populate_by,
  relation_to   public.enum__pages_v_blocks_archive_relation_to DEFAULT 'posts'::public.enum__pages_v_blocks_archive_relation_to,
  "limit"       numeric                                         DEFAULT 10,
  _uuid         character varying,
  block_name    character varying
);

CREATE INDEX _pages_v_blocks_archive_parent_id_idx ON public._pages_v_blocks_archive (_parent_id);

CREATE INDEX _pages_v_blocks_archive_order_idx ON public._pages_v_blocks_archive (_order);

CREATE INDEX _pages_v_blocks_archive_path_idx ON public._pages_v_blocks_archive (_path);

ALTER SEQUENCE public._pages_v_blocks_archive_id_seq OWNED BY public._pages_v_blocks_archive.id;

ALTER TABLE public._pages_v_blocks_archive
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_archive
  ADD CONSTRAINT _pages_v_blocks_archive_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_archive
  ADD CONSTRAINT _pages_v_blocks_archive_pkey PRIMARY KEY (id);