CREATE TABLE public.payload_locked_documents_rels (
  id                 integer           DEFAULT nextval('public.payload_locked_documents_rels_id_seq'::regclass) NOT NULL,
  "order"            integer,
  parent_id          integer           NOT NULL,
  path               character varying NOT NULL,
  pages_id           integer,
  posts_id           integer,
  media_id           integer,
  categories_id      integer,
  quick_links_id     integer,
  time_zones_id      integer,
  knowledge_base_id  integer,
  events_id          integer,
  edms_id            integer,
  permissions_id     integer,
  users_id           character varying,
  redirects_id       integer,
  search_id          integer,
  payload_folders_id integer,
  departments_id     character varying
);

CREATE INDEX payload_locked_documents_rels_knowledge_base_id_idx ON public.payload_locked_documents_rels (knowledge_base_id);

CREATE INDEX payload_locked_documents_rels_search_id_idx ON public.payload_locked_documents_rels (search_id);

CREATE INDEX payload_locked_documents_rels_redirects_id_idx ON public.payload_locked_documents_rels (redirects_id);

CREATE INDEX payload_locked_documents_rels_quick_links_id_idx ON public.payload_locked_documents_rels (quick_links_id);

CREATE INDEX payload_locked_documents_rels_posts_id_idx ON public.payload_locked_documents_rels (posts_id);

CREATE INDEX payload_locked_documents_rels_permissions_id_idx ON public.payload_locked_documents_rels (permissions_id);

CREATE INDEX payload_locked_documents_rels_payload_folders_id_idx ON public.payload_locked_documents_rels (payload_folders_id);

CREATE INDEX payload_locked_documents_rels_path_idx ON public.payload_locked_documents_rels (path);

CREATE INDEX payload_locked_documents_rels_parent_idx ON public.payload_locked_documents_rels (parent_id);

CREATE INDEX payload_locked_documents_rels_pages_id_idx ON public.payload_locked_documents_rels (pages_id);

CREATE INDEX payload_locked_documents_rels_order_idx ON public.payload_locked_documents_rels ("order");

CREATE INDEX payload_locked_documents_rels_categories_id_idx ON public.payload_locked_documents_rels (categories_id);

CREATE INDEX payload_locked_documents_rels_edms_id_idx ON public.payload_locked_documents_rels (edms_id);

CREATE INDEX payload_locked_documents_rels_events_id_idx ON public.payload_locked_documents_rels (events_id);

CREATE INDEX payload_locked_documents_rels_media_id_idx ON public.payload_locked_documents_rels (media_id);

CREATE INDEX payload_locked_documents_rels_users_id_idx ON public.payload_locked_documents_rels (users_id);

CREATE INDEX payload_locked_documents_rels_time_zones_id_idx ON public.payload_locked_documents_rels (time_zones_id);

ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNED BY public.payload_locked_documents_rels.id;

ALTER TABLE public.payload_locked_documents_rels
  OWNER TO payload_app;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_categories_fk FOREIGN KEY (categories_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_departments_fk FOREIGN KEY (departments_id) REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_edms_fk FOREIGN KEY (edms_id) REFERENCES public.edms(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_events_fk FOREIGN KEY (events_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_knowledge_base_fk FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_base(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_locked_documents(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_payload_folders_fk FOREIGN KEY (payload_folders_id) REFERENCES public.payload_folders(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_permissions_fk FOREIGN KEY (permissions_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_quick_links_fk FOREIGN KEY (quick_links_id) REFERENCES public.quick_links(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_redirects_fk FOREIGN KEY (redirects_id) REFERENCES public.redirects(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_search_fk FOREIGN KEY (search_id) REFERENCES public.search(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_time_zones_fk FOREIGN KEY (time_zones_id) REFERENCES public.time_zones(id) ON DELETE CASCADE;

ALTER TABLE public.payload_locked_documents_rels
  ADD CONSTRAINT payload_locked_documents_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;