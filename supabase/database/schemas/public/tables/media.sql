CREATE TABLE public.media (
  id                        integer                     DEFAULT nextval('public.media_id_seq'::regclass) NOT NULL,
  alt                       character varying,
  caption                   jsonb,
  folder_id                 integer,
  updated_at                timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at                timestamp(3) with time zone DEFAULT now() NOT NULL,
  url                       character varying,
  thumbnail_u_r_l           character varying,
  filename                  character varying,
  mime_type                 character varying,
  filesize                  numeric,
  width                     numeric,
  height                    numeric,
  focal_x                   numeric,
  focal_y                   numeric,
  sizes_thumbnail_url       character varying,
  sizes_thumbnail_width     numeric,
  sizes_thumbnail_height    numeric,
  sizes_thumbnail_mime_type character varying,
  sizes_thumbnail_filesize  numeric,
  sizes_thumbnail_filename  character varying,
  sizes_square_url          character varying,
  sizes_square_width        numeric,
  sizes_square_height       numeric,
  sizes_square_mime_type    character varying,
  sizes_square_filesize     numeric,
  sizes_square_filename     character varying,
  sizes_small_url           character varying,
  sizes_small_width         numeric,
  sizes_small_height        numeric,
  sizes_small_mime_type     character varying,
  sizes_small_filesize      numeric,
  sizes_small_filename      character varying,
  sizes_medium_url          character varying,
  sizes_medium_width        numeric,
  sizes_medium_height       numeric,
  sizes_medium_mime_type    character varying,
  sizes_medium_filesize     numeric,
  sizes_medium_filename     character varying,
  sizes_large_url           character varying,
  sizes_large_width         numeric,
  sizes_large_height        numeric,
  sizes_large_mime_type     character varying,
  sizes_large_filesize      numeric,
  sizes_large_filename      character varying,
  sizes_xlarge_url          character varying,
  sizes_xlarge_width        numeric,
  sizes_xlarge_height       numeric,
  sizes_xlarge_mime_type    character varying,
  sizes_xlarge_filesize     numeric,
  sizes_xlarge_filename     character varying,
  sizes_og_url              character varying,
  sizes_og_width            numeric,
  sizes_og_height           numeric,
  sizes_og_mime_type        character varying,
  sizes_og_filesize         numeric,
  sizes_og_filename         character varying
);

CREATE UNIQUE INDEX media_filename_idx ON public.media (filename);

CREATE INDEX media_updated_at_idx ON public.media (updated_at);

CREATE INDEX media_sizes_xlarge_sizes_xlarge_filename_idx ON public.media (sizes_xlarge_filename);

CREATE INDEX media_sizes_thumbnail_sizes_thumbnail_filename_idx ON public.media (sizes_thumbnail_filename);

CREATE INDEX media_sizes_square_sizes_square_filename_idx ON public.media (sizes_square_filename);

CREATE INDEX media_sizes_small_sizes_small_filename_idx ON public.media (sizes_small_filename);

CREATE INDEX media_sizes_og_sizes_og_filename_idx ON public.media (sizes_og_filename);

CREATE INDEX media_sizes_medium_sizes_medium_filename_idx ON public.media (sizes_medium_filename);

CREATE INDEX media_sizes_large_sizes_large_filename_idx ON public.media (sizes_large_filename);

CREATE INDEX media_folder_idx ON public.media (folder_id);

CREATE INDEX media_created_at_idx ON public.media (created_at);

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;

ALTER TABLE public.media
  OWNER TO payload_app;

ALTER TABLE public.media
  ADD CONSTRAINT media_pkey PRIMARY KEY (id);

ALTER TABLE public.media
  ADD CONSTRAINT media_folder_id_payload_folders_id_fk FOREIGN KEY (folder_id) REFERENCES public.payload_folders(id) ON DELETE SET NULL;