CREATE SEQUENCE pre_departure.pnr_audit_log_id_seq AS integer;

GRANT SELECT, USAGE ON SEQUENCE pre_departure.pnr_audit_log_id_seq TO authenticated;

GRANT SELECT, USAGE ON SEQUENCE pre_departure.pnr_audit_log_id_seq TO service_role;