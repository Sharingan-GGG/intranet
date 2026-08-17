CREATE TABLE pre_departure.pages (
  id         text                     NOT NULL,
  label      text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE pre_departure.pages
  OWNER TO payload_app;

ALTER TABLE pre_departure.pages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.pages
  ADD CONSTRAINT pages_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT ON pre_departure.pages TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pages TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.pages TO service_role;