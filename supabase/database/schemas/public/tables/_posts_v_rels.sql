CREATE TABLE public._posts_v_rels (
  id            integer           DEFAULT nextval('public._posts_v_rels_id_seq'::regclass) NOT NULL,
  "order"       integer,
  parent_id     integer           NOT NULL,
  path          character varying NOT NULL,
  posts_id      integer,
  categories_id integer,
  users_id      character varying
);

CREATE INDEX _posts_v_rels_categories_id_idx ON public._posts_v_rels (categories_id);

CREATE INDEX _posts_v_rels_order_idx ON public._posts_v_rels ("order");

CREATE INDEX _posts_v_rels_parent_idx ON public._posts_v_rels (parent_id);

CREATE INDEX _posts_v_rels_path_idx ON public._posts_v_rels (path);

CREATE INDEX _posts_v_rels_posts_id_idx ON public._posts_v_rels (posts_id);

CREATE INDEX _posts_v_rels_users_id_idx ON public._posts_v_rels (users_id);

ALTER SEQUENCE public._posts_v_rels_id_seq OWNED BY public._posts_v_rels.id;

ALTER TABLE public._posts_v_rels
  OWNER TO payload_app;

ALTER TABLE public._posts_v_rels
  ADD CONSTRAINT _posts_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._posts_v(id) ON DELETE CASCADE;

ALTER TABLE public._posts_v_rels
  ADD CONSTRAINT _posts_v_rels_pkey PRIMARY KEY (id);

ALTER TABLE public._posts_v_rels
  ADD CONSTRAINT _posts_v_rels_categories_fk FOREIGN KEY (categories_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public._posts_v_rels
  ADD CONSTRAINT _posts_v_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public._posts_v_rels
  ADD CONSTRAINT _posts_v_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;