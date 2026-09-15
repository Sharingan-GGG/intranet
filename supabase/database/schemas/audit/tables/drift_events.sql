CREATE TABLE audit.drift_events (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  url         text                     NOT NULL,
  event_type  text                     NOT NULL,
  field       text,
  old_value   text,
  new_value   text,
  severity    text,
  detected_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE audit.drift_events
  OWNER TO payload_app;

ALTER TABLE audit.drift_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.drift_events
  ADD CONSTRAINT drift_events_pkey PRIMARY KEY (id);

CREATE INDEX drift_events_url_detected_at_idx ON audit.drift_events (url, detected_at DESC);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.drift_events TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.drift_events TO service_role;
