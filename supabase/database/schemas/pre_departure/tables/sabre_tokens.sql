CREATE TABLE pre_departure.sabre_tokens (
  id                            text                     DEFAULT 'staging'::text NOT NULL,
  json_token                    text,
  json_token_expires_at         timestamp with time zone,
  soap_session_token            text,
  soap_session_token_expires_at timestamp with time zone,
  updated_at                    timestamp with time zone
);

CREATE POLICY "authenticated read sabre_tokens" ON pre_departure.sabre_tokens
  FOR SELECT
  USING ((auth.role() = 'authenticated'::text));

CREATE POLICY service_role_access ON pre_departure.sabre_tokens
  USING ((auth.role() = 'service_role'::text));

ALTER TABLE pre_departure.sabre_tokens
  OWNER TO payload_app;

ALTER TABLE pre_departure.sabre_tokens
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.sabre_tokens
  ADD CONSTRAINT sabre_tokens_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT ON pre_departure.sabre_tokens TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.sabre_tokens TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.sabre_tokens TO service_role;