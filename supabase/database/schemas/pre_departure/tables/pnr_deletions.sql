CREATE TABLE pre_departure.pnr_deletions (
  pnr        text                     NOT NULL,
  deleted_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE pre_departure.pnr_deletions
  OWNER TO payload_app;

ALTER TABLE pre_departure.pnr_deletions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pnr_deletions
  ADD CONSTRAINT pnr_deletions_pkey PRIMARY KEY (pnr);

GRANT INSERT, SELECT ON pre_departure.pnr_deletions TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_deletions TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pnr_deletions TO service_role;