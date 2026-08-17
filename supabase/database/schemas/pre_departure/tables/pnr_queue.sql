CREATE TABLE pre_departure.pnr_queue (
  id              integer                  DEFAULT nextval('pre_departure.pnr_queue_id_seq'::regclass) NOT NULL,
  pnr             text                     NOT NULL,
  brand           text                     NOT NULL,
  queue_status    text                     DEFAULT 'pending'::text NOT NULL,
  batch_id        integer,
  added_by        character varying,
  created_at      timestamp with time zone DEFAULT now(),
  processed_at    timestamp with time zone,
  client_name     text,
  departure_date  text,
  consultant_name text,
  pnr_type        text,
  brand_id        integer                  NOT NULL,
  sheet_row       integer
);

CREATE TRIGGER trg_pnr_queue_brand_text
  BEFORE INSERT OR UPDATE ON pre_departure.pnr_queue
  FOR EACH ROW
  EXECUTE FUNCTION pre_departure.sync_pnr_queue_brand_text();

CREATE POLICY "authenticated read pnr_queue" ON pre_departure.pnr_queue
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.pnr_queue_id_seq OWNED BY pre_departure.pnr_queue.id;

ALTER TABLE pre_departure.pnr_queue
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_queue
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_queue
  ADD CONSTRAINT pnr_queue_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES pre_departure.brands(id);

ALTER TABLE pre_departure.pnr_queue
  ADD CONSTRAINT pnr_queue_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_queue
  ADD CONSTRAINT pnr_queue_pnr_key UNIQUE (pnr);

ALTER TABLE pre_departure.pnr_queue
  ADD CONSTRAINT pnr_queue_queue_status_check
    CHECK (queue_status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text, 'exception'::text, 'no-flight'::text]));

ALTER TABLE pre_departure.pnr_queue
  ADD CONSTRAINT pnr_queue_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);

GRANT INSERT, SELECT ON pre_departure.pnr_queue TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_queue TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_queue TO service_role;