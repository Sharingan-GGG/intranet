CREATE TABLE pre_departure.pnr_json (
  id             integer                  DEFAULT nextval('pre_departure.pnr_json_id_seq'::regclass) NOT NULL,
  pnr_history_id integer                  NOT NULL,
  data           jsonb                    NOT NULL,
  fetched_at     timestamp with time zone DEFAULT now(),
  brand_id       integer                  NOT NULL
);

CREATE POLICY "authenticated read pnr_json" ON pre_departure.pnr_json
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.pnr_json_id_seq OWNED BY pre_departure.pnr_json.id;

ALTER TABLE pre_departure.pnr_json
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_json
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_json
  ADD CONSTRAINT pnr_json_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES pre_departure.brands(id);

ALTER TABLE pre_departure.pnr_json
  ADD CONSTRAINT pnr_json_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_json
  ADD CONSTRAINT pnr_json_pnr_history_id_fkey FOREIGN KEY (pnr_history_id) REFERENCES pre_departure.pnr_history(id) ON DELETE CASCADE;

ALTER TABLE pre_departure.pnr_json
  ADD CONSTRAINT pnr_json_pnr_history_id_key UNIQUE (pnr_history_id);

GRANT INSERT, SELECT ON pre_departure.pnr_json TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_json TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_json TO service_role;