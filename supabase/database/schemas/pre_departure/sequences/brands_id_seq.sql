CREATE SEQUENCE pre_departure.brands_id_seq AS integer;

GRANT SELECT, USAGE ON SEQUENCE pre_departure.brands_id_seq TO authenticated;

GRANT SELECT, USAGE ON SEQUENCE pre_departure.brands_id_seq TO service_role;