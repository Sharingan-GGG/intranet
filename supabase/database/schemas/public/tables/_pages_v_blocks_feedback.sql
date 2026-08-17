CREATE TABLE public._pages_v_blocks_feedback (
  _order                     integer           NOT NULL,
  _parent_id                 integer           NOT NULL,
  _path                      text              NOT NULL,
  id                         integer           DEFAULT nextval('public._pages_v_blocks_feedback_id_seq'::regclass) NOT NULL,
  _uuid                      character varying,
  block_name                 character varying,
  org_chart_title            character varying,
  org_chart_description      character varying,
  org_chart_button_label     character varying,
  org_chart_button_url       character varying,
  feedback_form_title        character varying,
  feedback_form_description  character varying,
  feedback_form_button_label character varying,
  feedback_form_button_url   character varying
);

CREATE INDEX _pages_v_blocks_feedback_parent_id_idx ON public._pages_v_blocks_feedback (_parent_id);

CREATE INDEX _pages_v_blocks_feedback_path_idx ON public._pages_v_blocks_feedback (_path);

CREATE INDEX _pages_v_blocks_feedback_order_idx ON public._pages_v_blocks_feedback (_order);

ALTER SEQUENCE public._pages_v_blocks_feedback_id_seq OWNED BY public._pages_v_blocks_feedback.id;

ALTER TABLE public._pages_v_blocks_feedback
  OWNER TO payload_app;

ALTER TABLE public._pages_v_blocks_feedback
  ADD CONSTRAINT _pages_v_blocks_feedback_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;

ALTER TABLE public._pages_v_blocks_feedback
  ADD CONSTRAINT _pages_v_blocks_feedback_pkey PRIMARY KEY (id);