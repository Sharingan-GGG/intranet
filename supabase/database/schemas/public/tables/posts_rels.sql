CREATE TABLE public.posts_rels (
  id            integer           DEFAULT nextval('public.posts_rels_id_seq'::regclass) NOT NULL,
  "order"       integer,
  parent_id     integer           NOT NULL,
  path          character varying NOT NULL,
  posts_id      integer,
  categories_id integer,
  users_id      character varying
);

CREATE INDEX posts_rels_categories_id_idx ON public.posts_rels (categories_id);

CREATE INDEX posts_rels_parent_idx ON public.posts_rels (parent_id);

CREATE INDEX posts_rels_path_idx ON public.posts_rels (path);

CREATE INDEX posts_rels_posts_id_idx ON public.posts_rels (posts_id);

CREATE INDEX posts_rels_users_id_idx ON public.posts_rels (users_id);

CREATE INDEX posts_rels_order_idx ON public.posts_rels ("order");

ALTER SEQUENCE public.posts_rels_id_seq OWNED BY public.posts_rels.id;

ALTER TABLE public.posts_rels
  OWNER TO payload_app;

ALTER TABLE public.posts_rels
  ADD CONSTRAINT posts_rels_categories_fk FOREIGN KEY (categories_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.posts_rels
  ADD CONSTRAINT posts_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.posts_rels
  ADD CONSTRAINT posts_rels_pkey PRIMARY KEY (id);

ALTER TABLE public.posts_rels
  ADD CONSTRAINT posts_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.posts_rels
  ADD CONSTRAINT posts_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;