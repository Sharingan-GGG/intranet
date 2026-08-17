CREATE TABLE pre_departure.brands (
  id         integer                  DEFAULT nextval('pre_departure.brands_id_seq'::regclass) NOT NULL,
  code       text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE POLICY "authenticated read brands" ON pre_departure.brands
  FOR SELECT
  USING ((auth.role() = 'authenticated'::text));

ALTER SEQUENCE pre_departure.brands_id_seq OWNED BY pre_departure.brands.id;

ALTER TABLE pre_departure.brands
  OWNER TO payload_app;

ALTER TABLE pre_departure.brands
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.brands
  ADD CONSTRAINT brands_code_key UNIQUE (code);

ALTER TABLE pre_departure.brands
  ADD CONSTRAINT brands_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT ON pre_departure.brands TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.brands TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.brands TO service_role;