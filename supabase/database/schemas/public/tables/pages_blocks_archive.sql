CREATE TABLE public.pages_blocks_archive (
  _order        integer                                      NOT NULL,
  _parent_id    integer                                      NOT NULL,
  _path         text                                         NOT NULL,
  id            character varying                            NOT NULL,
  intro_content jsonb,
  populate_by   public.enum_pages_blocks_archive_populate_by DEFAULT 'collection'::public.enum_pages_blocks_archive_populate_by,
  relation_to   public.enum_pages_blocks_archive_relation_to DEFAULT 'posts'::public.enum_pages_blocks_archive_relation_to,
  "limit"       numeric                                      DEFAULT 10,
  block_name    character varying
);

CREATE INDEX pages_blocks_archive_parent_id_idx ON public.pages_blocks_archive (_parent_id);

CREATE INDEX pages_blocks_archive_path_idx ON public.pages_blocks_archive (_path);

CREATE INDEX pages_blocks_archive_order_idx ON public.pages_blocks_archive (_order);

ALTER TABLE public.pages_blocks_archive
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_archive
  ADD CONSTRAINT pages_blocks_archive_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_archive
  ADD CONSTRAINT pages_blocks_archive_pkey PRIMARY KEY (id);