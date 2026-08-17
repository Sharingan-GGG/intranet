CREATE TABLE pre_departure.pnr_scan_outcomes (
  id              bigint                   DEFAULT nextval('pre_departure.pnr_scan_outcomes_id_seq'::regclass) NOT NULL,
  pnr             text                     NOT NULL,
  brand_id        integer                  NOT NULL,
  verdict         text                     NOT NULL,
  decided_at      timestamp with time zone DEFAULT now() NOT NULL,
  queued_at       timestamp with time zone NOT NULL,
  consultant_name text
);

ALTER SEQUENCE pre_departure.pnr_scan_outcomes_id_seq OWNED BY pre_departure.pnr_scan_outcomes.id;

ALTER TABLE pre_departure.pnr_scan_outcomes
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_scan_outcomes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_scan_outcomes
  ADD CONSTRAINT pnr_scan_outcomes_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES pre_departure.brands(id);

ALTER TABLE pre_departure.pnr_scan_outcomes
  ADD CONSTRAINT pnr_scan_outcomes_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_scan_outcomes
  ADD CONSTRAINT pnr_scan_outcomes_pnr_queued_at_key UNIQUE (pnr, queued_at);

ALTER TABLE pre_departure.pnr_scan_outcomes
  ADD CONSTRAINT pnr_scan_outcomes_verdict_check CHECK (verdict = ANY (ARRAY['pending'::text, 'exception'::text]));

GRANT INSERT, SELECT ON pre_departure.pnr_scan_outcomes TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_scan_outcomes TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_scan_outcomes TO service_role;