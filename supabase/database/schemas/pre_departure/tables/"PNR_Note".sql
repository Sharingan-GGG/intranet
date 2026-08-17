CREATE TABLE pre_departure."PNR_Note" (
  "PNR"        text                     NOT NULL,
  "Notes"      text                     NOT NULL,
  "Note_By"    text                     NOT NULL,
  "Created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "Updated at" timestamp with time zone
);

CREATE POLICY "authenticated_all_PNR_Note" ON pre_departure."PNR_Note"
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE pre_departure."PNR_Note"
  OWNER TO payload_app;

ALTER TABLE pre_departure."PNR_Note"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure."PNR_Note"
  ADD CONSTRAINT "PNR_Note_pkey" PRIMARY KEY ("PNR", "Created_at");

GRANT INSERT, SELECT ON pre_departure."PNR_Note" TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure."PNR_Note" TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure."PNR_Note" TO service_role;