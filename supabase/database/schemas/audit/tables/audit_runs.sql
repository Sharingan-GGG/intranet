CREATE TABLE audit.audit_runs (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  url        text                     NOT NULL,
  run_type   text                     NOT NULL,
  agents_run text[],
  overall    numeric,
  dimensions jsonb,
  report     jsonb,
  delta      numeric,
  ran_at     timestamp with time zone DEFAULT now() NOT NULL,
  tracker_id uuid
);

ALTER TABLE audit.audit_runs
  OWNER TO payload_app;

ALTER TABLE audit.audit_runs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.audit_runs
  ADD CONSTRAINT audit_runs_pkey PRIMARY KEY (id);

-- Deliberately NO ACTION, not CASCADE. The portal deletes a tracker row to
-- cancel a scheduled scan; cascading would silently destroy that page's entire
-- audit history along with it. A tracker row that still has runs must fail the
-- delete loudly so the caller unpublishes or re-points instead.
ALTER TABLE audit.audit_runs
  ADD CONSTRAINT audit_runs_tracker_id_fkey FOREIGN KEY (tracker_id)
  REFERENCES audit.seo_agent_tracker(id);

-- "Newest run per tracker" is the hot path; see views/tracker_latest_run.sql.
CREATE INDEX audit_runs_tracker_id_ran_at_idx ON audit.audit_runs (tracker_id, ran_at DESC);

CREATE INDEX audit_runs_url_idx ON audit.audit_runs (url);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.audit_runs TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.audit_runs TO service_role;
