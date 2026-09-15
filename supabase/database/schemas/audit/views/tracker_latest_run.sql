-- Replaces a client-side "order by ran_at desc, keep the first row per tracker"
-- loop that the standalone portal repeated in four separate places, each time
-- after fetching every run for the domain. The Marketing/IT open-issue split
-- depends on only the newest run counting, so this makes that rule a property
-- of the database rather than of four hand-written loops.
CREATE VIEW audit.tracker_latest_run AS
SELECT DISTINCT ON (r.tracker_id)
  r.id AS run_id,
  r.tracker_id,
  r.url,
  r.run_type,
  r.agents_run,
  r.overall,
  r.delta,
  r.dimensions,
  r.ran_at
FROM audit.audit_runs r
WHERE r.tracker_id IS NOT NULL
ORDER BY r.tracker_id, r.ran_at DESC;

ALTER VIEW audit.tracker_latest_run
  OWNER TO payload_app;

-- security_invoker so the view respects the caller's RLS rather than the
-- owner's, matching how every base table in this schema is gated.
ALTER VIEW audit.tracker_latest_run
  SET (security_invoker = true);

GRANT SELECT ON audit.tracker_latest_run TO authenticated;

GRANT SELECT ON audit.tracker_latest_run TO service_role;
