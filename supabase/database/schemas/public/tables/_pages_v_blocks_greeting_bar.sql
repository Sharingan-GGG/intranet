CREATE TABLE public._pages_v_blocks_greeting_bar (
  _order     integer           NOT NULL,
  _parent_id integer           NOT NULL,
  _path      text              NOT NULL,
  id         integer           DEFAULT nextval('public._pages_v_blocks_greeting_bar_id_seq'::regclass) NOT NULL,
  _uuid      character varying,
  block_name character varying
);

CREATE INDEX _pages_v_blocks_greeting_bar_path_idx ON public._pages_v_blocks_greeting_bar (_path);

CREATE INDEX _pages_v_blocks_greeting_bar_order_idx ON public._pages_v_blocks_greeting_bar (_order);

CREATE INDEX _pages_v_blocks_greeting_bar_parent_id_idx ON public._pages_v_blocks_greeting_bar (_parent_id);

ALTER SEQUENCE public._pages_v_blocks_greeting_bar_id_seq OWNED BY public._pages_v_blocks_greeting_bar.id;

ALTER TABLE public._pages_v_blocks_greeting_bar
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_greeting_bar
  ADD CONSTRAINT _pages_v_blocks_greeting_bar_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_greeting_bar
  ADD CONSTRAINT _pages_v_blocks_greeting_bar_pkey PRIMARY KEY (id);