CREATE TABLE audit.content_audits (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  url            text                     NOT NULL,
  domain         text                     NOT NULL,
  status         text                     DEFAULT 'queued'::text NOT NULL,
  error          text,
  queued_at      timestamp with time zone DEFAULT now() NOT NULL,
  started_at     timestamp with time zone,
  finished_at    timestamp with time zone,
  report         jsonb,
  summary_report jsonb,
  archived       boolean                  DEFAULT false NOT NULL
);

ALTER TABLE audit.content_audits
  OWNER TO payload_app;

ALTER TABLE audit.content_audits
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.content_audits
  ADD CONSTRAINT content_audits_pkey PRIMARY KEY (id);

-- url is the on_conflict target for the queue upsert (Prefer:
-- resolution=merge-duplicates), so the unique constraint is load-bearing.
ALTER TABLE audit.content_audits
  ADD CONSTRAINT content_audits_url_key UNIQUE (url);

ALTER TABLE audit.content_audits
  ADD CONSTRAINT content_audits_status_check
  CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'error'::text]));

CREATE INDEX content_audits_domain_archived_idx ON audit.content_audits (domain, archived);

CREATE INDEX content_audits_status_idx ON audit.content_audits (status);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.content_audits TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.content_audits TO service_role;
