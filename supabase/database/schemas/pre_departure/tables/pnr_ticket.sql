CREATE TABLE pre_departure.pnr_ticket (
  id             integer                  DEFAULT nextval('pre_departure.pnr_ticket_id_seq'::regclass) NOT NULL,
  pnr_history_id integer                  NOT NULL,
  soap_xml       text                     NOT NULL,
  fetched_at     timestamp with time zone DEFAULT now(),
  data           jsonb,
  brand_id       integer                  NOT NULL
);

CREATE POLICY "authenticated read pnr_ticket" ON pre_departure.pnr_ticket
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.pnr_ticket_id_seq OWNED BY pre_departure.pnr_ticket.id;

ALTER TABLE pre_departure.pnr_ticket
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_ticket
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_ticket
  ADD CONSTRAINT pnr_ticket_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES pre_departure.brands(id);

ALTER TABLE pre_departure.pnr_ticket
  ADD CONSTRAINT pnr_ticket_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_ticket
  ADD CONSTRAINT pnr_ticket_pnr_history_id_fkey FOREIGN KEY (pnr_history_id) REFERENCES pre_departure.pnr_history(id) ON DELETE CASCADE;

ALTER TABLE pre_departure.pnr_ticket
  ADD CONSTRAINT pnr_ticket_pnr_history_id_key UNIQUE (pnr_history_id);

GRANT INSERT, SELECT ON pre_departure.pnr_ticket TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_ticket TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_ticket TO service_role;