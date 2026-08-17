CREATE TABLE pre_departure.pnr_audit_log (
  id           integer                  DEFAULT nextval('pre_departure.pnr_audit_log_id_seq'::regclass) NOT NULL,
  pnr          text                     NOT NULL,
  brand        text,
  action       text                     NOT NULL,
  performed_by character varying,
  performed_at timestamp with time zone DEFAULT now(),
  meta         jsonb
);

CREATE POLICY "authenticated read pnr_audit_log" ON pre_departure.pnr_audit_log
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.pnr_audit_log_id_seq OWNED BY pre_departure.pnr_audit_log.id;

ALTER TABLE pre_departure.pnr_audit_log
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_audit_log
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_audit_log
  ADD CONSTRAINT pnr_audit_log_action_check CHECK (action = ANY (ARRAY['scanned'::text, 'synced'::text, 'moved'::text, 'deleted'::text, 'restored'::text]));

ALTER TABLE pre_departure.pnr_audit_log
  ADD CONSTRAINT pnr_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.pnr_audit_log
  ADD CONSTRAINT pnr_audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);

GRANT INSERT, SELECT ON pre_departure.pnr_audit_log TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_audit_log TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_audit_log TO service_role;