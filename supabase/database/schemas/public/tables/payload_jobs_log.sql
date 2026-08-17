CREATE TABLE public.payload_jobs_log (
  _order       integer                                NOT NULL,
  _parent_id   integer                                NOT NULL,
  id           character varying                      NOT NULL,
  executed_at  timestamp(3) with time zone            NOT NULL,
  completed_at timestamp(3) with time zone            NOT NULL,
  task_slug    public.enum_payload_jobs_log_task_slug NOT NULL,
  task_i_d     character varying                      NOT NULL,
  input        jsonb,
  output       jsonb,
  state        public.enum_payload_jobs_log_state     NOT NULL,
  error        jsonb
);

CREATE INDEX payload_jobs_log_parent_id_idx ON public.payload_jobs_log (_parent_id);

CREATE INDEX payload_jobs_log_order_idx ON public.payload_jobs_log (_order);

ALTER TABLE public.payload_jobs_log
  OWNER TO payload_app;

ALTER TABLE public.payload_jobs_log
  ADD CONSTRAINT payload_jobs_log_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.payload_jobs(id) ON DELETE CASCADE;

ALTER TABLE public.payload_jobs_log
  ADD CONSTRAINT payload_jobs_log_pkey PRIMARY KEY (id);