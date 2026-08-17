CREATE TABLE public.pages_blocks_feedback (
  _order                     integer           NOT NULL,
  _parent_id                 integer           NOT NULL,
  _path                      text              NOT NULL,
  id                         character varying NOT NULL,
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

CREATE INDEX pages_blocks_feedback_parent_id_idx ON public.pages_blocks_feedback (_parent_id);

CREATE INDEX pages_blocks_feedback_path_idx ON public.pages_blocks_feedback (_path);

CREATE INDEX pages_blocks_feedback_order_idx ON public.pages_blocks_feedback (_order);

ALTER TABLE public.pages_blocks_feedback
  OWNER TO payload_app;

ALTER TABLE public.pages_blocks_feedback
  ADD CONSTRAINT pages_blocks_feedback_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

ALTER TABLE public.pages_blocks_feedback
  ADD CONSTRAINT pages_blocks_feedback_pkey PRIMARY KEY (id);