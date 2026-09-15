-- The queue the standalone site-content-audit worker drains. In the old
-- project this table had no primary key at all; id and url were both already
-- unique across all 817 rows, so both constraints are added here.
CREATE TABLE audit.seo_site_content_audit (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  domain        text                     NOT NULL,
  url           text                     NOT NULL,
  status        audit.status_type        DEFAULT 'Not Yet Started'::audit.status_type,
  schedule      audit.schedule_type      DEFAULT 'Quarterly'::audit.schedule_type,
  executed_date date,
  type          text                     NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  overall       numeric,
  report        jsonb
);

ALTER TABLE audit.seo_site_content_audit
  OWNER TO payload_app;

ALTER TABLE audit.seo_site_content_audit
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.seo_site_content_audit
  ADD CONSTRAINT seo_site_content_audit_pkey PRIMARY KEY (id);

ALTER TABLE audit.seo_site_content_audit
  ADD CONSTRAINT seo_site_content_audit_url_key UNIQUE (url);

CREATE INDEX seo_site_content_audit_domain_idx ON audit.seo_site_content_audit (domain);

CREATE INDEX seo_site_content_audit_status_idx ON audit.seo_site_content_audit (status);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.seo_site_content_audit TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.seo_site_content_audit TO service_role;
