CREATE TABLE audit.drift_baselines (
  url         text                     NOT NULL,
  baseline    jsonb                    NOT NULL,
  captured_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE audit.drift_baselines
  OWNER TO payload_app;

ALTER TABLE audit.drift_baselines
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.drift_baselines
  ADD CONSTRAINT drift_baselines_pkey PRIMARY KEY (url);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.drift_baselines TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.drift_baselines TO service_role;
