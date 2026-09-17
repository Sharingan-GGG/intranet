-- Every GA4 property the service account can see, refreshed on each ingest.
--
-- The roster is discovered, not configured: the service account is a Viewer at
-- the GA *account* level, so a property added in GA appears here on the next
-- nightly run with nothing to deploy. (Granted per-property instead, the Admin
-- API lists nothing and this table stays empty — that is the one setup mistake
-- that fails silently.)
CREATE TABLE audit.ga4_properties (
  property_id   text                     NOT NULL,
  display_name  text                     NOT NULL,
  account_id    text,
  account_name  text,
  -- Bare hostname taken from the property's web data stream `defaultUri`, so a
  -- property lines up with SITES in src/lib/audit-config.ts on its own. Derived
  -- from the stream URI and never from `display_name`: names are prose and do
  -- not reliably carry the hostname, which would make the join quietly wrong.
  -- Nullable (app/server streams have no URI) and hand-editable — the ingest
  -- coalesces, so a value set by hand survives a night when the lookup fails.
  domain        text,
  -- The property's own reporting timezone. `date` below is in *this* zone, not
  -- UTC and not the server's: AU and NZ properties genuinely disagree about
  -- which day "yesterday" was.
  time_zone     text,
  -- Discovery is a full re-list each run. A property that stops appearing was
  -- deleted, or our access was revoked; it is flagged rather than deleted so
  -- its historical rows keep a name to render.
  is_active     boolean                  DEFAULT true NOT NULL,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE audit.ga4_properties
  OWNER TO payload_app;

ALTER TABLE audit.ga4_properties
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.ga4_properties
  ADD CONSTRAINT ga4_properties_pkey PRIMARY KEY (property_id);

CREATE INDEX ga4_properties_domain_idx ON audit.ga4_properties (domain);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.ga4_properties TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.ga4_properties TO service_role;
