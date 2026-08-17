CREATE TABLE pre_departure.pnr_p3 (
  id             integer                  DEFAULT nextval('pre_departure.pnr_p3_id_seq'::regclass) NOT NULL,
  pnr_history_id integer                  NOT NULL,
  soap_xml       text                     NOT NULL,
  fetched_at     timestamp with time zone DEFAULT now(),
  data           jsonb,
  brand_id       integer                  NOT NULL
);

CREATE POLICY "authenticated read pnr_p3" ON pre_departure.pnr_p3
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.pnr_p3_id_seq OWNED BY pre_departure.pnr_p3.id;

ALTER TABLE pre_departure.pnr_p3
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_p3
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_p3
  ADD CONSTRAINT pnr_p3_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES pre_departure.brands(id);

ALTER TABLE pre_departure.pnr_p3
  ADD CONSTRAINT pnr_p3_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_p3
  ADD CONSTRAINT pnr_p3_pnr_history_id_fkey FOREIGN KEY (pnr_history_id) REFERENCES pre_departure.pnr_history(id) ON DELETE CASCADE;

ALTER TABLE pre_departure.pnr_p3
  ADD CONSTRAINT pnr_p3_pnr_history_id_key UNIQUE (pnr_history_id);

GRANT INSERT, SELECT ON pre_departure.pnr_p3 TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_p3 TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_p3 TO service_role;