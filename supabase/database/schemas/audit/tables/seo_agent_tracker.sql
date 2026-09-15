-- Column names are preserved byte-for-byte from the standalone portal's
-- project, including the quoted "Full Scan" (space, capitalised) and "Domain"
-- (capital D, unlike content_audits.domain). The external seo-page-agents
-- routine reads and writes these columns directly, so renaming them here would
-- turn a one-line repoint into a coordinated multi-repo change. The cosmetic
-- cleanup lives in the TypeScript data layer instead.
CREATE TABLE audit.seo_agent_tracker (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  url               text,
  "Full Scan"       audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_content     audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_schema      audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_technical   audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_performance audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_geo         audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_sxo         audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_drift       audit.yes_no             DEFAULT 'No'::audit.yes_no,
  agent_semrush     audit.yes_no             DEFAULT 'No'::audit.yes_no,
  schedule          audit.schedule_type      DEFAULT 'Monthly'::audit.schedule_type,
  executed_date     date,
  status            audit.status_type        DEFAULT 'Not Yet Started'::audit.status_type,
  created_at        timestamp with time zone DEFAULT now(),
  "Domain"          text,
  started_at        timestamp with time zone,
  finished_at       timestamp with time zone,
  error             text,
  overall           numeric,
  assigned          text[]
);

ALTER TABLE audit.seo_agent_tracker
  OWNER TO payload_app;

ALTER TABLE audit.seo_agent_tracker
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.seo_agent_tracker
  ADD CONSTRAINT seo_agent_tracker_pkey PRIMARY KEY (id);

-- The worker claims work with a "started_at is null" filter; the dashboard
-- filters by domain and status on every load.
CREATE INDEX seo_agent_tracker_domain_idx ON audit.seo_agent_tracker ("Domain");

CREATE INDEX seo_agent_tracker_status_idx ON audit.seo_agent_tracker (status);

CREATE INDEX seo_agent_tracker_url_idx ON audit.seo_agent_tracker (url);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.seo_agent_tracker TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.seo_agent_tracker TO service_role;
