CREATE TABLE public._pages_v_blocks_knowledge_base (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_knowledge_base_id_seq'::regclass) NOT NULL,
  heading    character varying,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_knowledge_base_path_idx ON public._pages_v_blocks_knowledge_base (_path);

CREATE INDEX _pages_v_blocks_knowledge_base_order_idx ON public._pages_v_blocks_knowledge_base (_order);

CREATE INDEX _pages_v_blocks_knowledge_base_parent_id_idx ON public._pages_v_blocks_knowledge_base (_parent_id);

ALTER SEQUENCE public._pages_v_blocks_knowledge_base_id_seq OWNED BY public._pages_v_blocks_knowledge_base.id;

ALTER TABLE public._pages_v_blocks_knowledge_base
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_knowledge_base
  ADD CONSTRAINT _pages_v_blocks_knowledge_base_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_knowledge_base
  ADD CONSTRAINT _pages_v_blocks_knowledge_base_pkey PRIMARY KEY (id);