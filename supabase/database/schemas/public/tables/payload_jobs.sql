CREATE TABLE public.payload_jobs (
  id           integer                            DEFAULT nextval('public.payload_jobs_id_seq'::regclass) NOT NULL,
  input        jsonb,
  completed_at timestamp(3) with time zone,
  total_tried  numeric                            DEFAULT 0,
  has_error    boolean                            DEFAULT false,
  error        jsonb,
  task_slug    public.enum_payload_jobs_task_slug,
  queue        character varying                  DEFAULT 'default'::character varying,
  wait_until   timestamp(3) with time zone,
  processing   boolean                            DEFAULT false,
  updated_at   timestamp(3) with time zone        DEFAULT now() NOT NULL,
  created_at   timestamp(3) with time zone        DEFAULT now() NOT NULL
);

CREATE INDEX payload_jobs_queue_idx ON public.payload_jobs (queue);

CREATE INDEX payload_jobs_processing_idx ON public.payload_jobs (processing);

CREATE INDEX payload_jobs_has_error_idx ON public.payload_jobs (has_error);

CREATE INDEX payload_jobs_created_at_idx ON public.payload_jobs (created_at);

CREATE INDEX payload_jobs_completed_at_idx ON public.payload_jobs (completed_at);

CREATE INDEX payload_jobs_wait_until_idx ON public.payload_jobs (wait_until);

CREATE INDEX payload_jobs_updated_at_idx ON public.payload_jobs (updated_at);

CREATE INDEX payload_jobs_total_tried_idx ON public.payload_jobs (total_tried);

CREATE INDEX payload_jobs_task_slug_idx ON public.payload_jobs (task_slug);

ALTER SEQUENCE public.payload_jobs_id_seq OWNED BY public.payload_jobs.id;

ALTER TABLE public.payload_jobs
  OWNER TO payload_app;

ALTER TABLE public.payload_jobs
  ADD CONSTRAINT payload_jobs_pkey PRIMARY KEY (id);