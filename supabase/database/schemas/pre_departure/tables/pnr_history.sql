CREATE TABLE pre_departure.pnr_history (
  id              integer                  DEFAULT nextval('pre_departure.pnr_history_id_seq'::regclass) NOT NULL,
  pnr             text                     NOT NULL,
  status          text                     NOT NULL,
  client_name     text,
  departure_date  date,
  consultant_name text,
  pnr_type        text,
  deleted_at      timestamp with time zone,
  processed_at    timestamp with time zone DEFAULT now(),
  raw_summary     jsonb,
  brand_id        integer                  NOT NULL
);

CREATE POLICY "authenticated read pnr_history" ON pre_departure.pnr_history
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.pnr_history_id_seq OWNED BY pre_departure.pnr_history.id;

ALTER TABLE pre_departure.pnr_history
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_history
  ADD CONSTRAINT pnr_history_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES pre_departure.brands(id);

ALTER TABLE pre_departure.pnr_history
  ADD CONSTRAINT pnr_history_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_history
  ADD CONSTRAINT pnr_history_pnr_key UNIQUE (pnr);

ALTER TABLE pre_departure.pnr_history
  ADD CONSTRAINT pnr_history_status_check CHECK (status = ANY (ARRAY['SYNCED'::text, 'NO_FLIGHT'::text, 'TICKETED'::text, 'PROCESSING'::text, 'DELETED'::text]));

GRANT INSERT, SELECT ON pre_departure.pnr_history TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_history TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_history TO service_role;