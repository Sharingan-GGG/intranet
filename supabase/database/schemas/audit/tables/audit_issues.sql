CREATE TABLE audit.audit_issues (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  run_id         uuid                     NOT NULL,
  priority       text,
  dimension      text,
  title          text,
  recommendation text,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  assign_role    text[],
  fingerprint    text,
  done_at        timestamp with time zone
);

ALTER TABLE audit.audit_issues
  OWNER TO payload_app;

ALTER TABLE audit.audit_issues
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.audit_issues
  ADD CONSTRAINT audit_issues_pkey PRIMARY KEY (id);

ALTER TABLE audit.audit_issues
  ADD CONSTRAINT audit_issues_run_id_fkey FOREIGN KEY (run_id)
  REFERENCES audit.audit_runs(id) ON DELETE CASCADE;

-- The dashboard counts open/done x marketing/IT in one request by aliasing this
-- embed four times with per-alias filters; these two indexes back that query.
CREATE INDEX audit_issues_run_id_idx ON audit.audit_issues (run_id);

CREATE INDEX audit_issues_done_at_idx ON audit.audit_issues (done_at);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.audit_issues TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.audit_issues TO service_role;
