-- Per user per version: done, first pass date, best score, attempt count. Same rules as
-- src/lib/quiz/status.ts (which stays the source of truth for the full status). For ad-hoc
-- audit exports. security_invoker: RLS on attempts still applies to whoever queries it.
CREATE OR REPLACE VIEW cybersecurity_quiz.completions
  WITH (security_invoker = true)
AS
SELECT
  user_id,
  quiz_version,
  bool_or(passed)                         AS done,
  min(completed_at) FILTER (WHERE passed) AS first_passed_at,
  max(score)                              AS best_score,
  count(*)                                AS attempts,
  max(completed_at)                       AS last_attempt_at
FROM cybersecurity_quiz.attempts
WHERE completed_at IS NOT NULL
GROUP BY user_id, quiz_version;

ALTER VIEW cybersecurity_quiz.completions OWNER TO payload_app;

REVOKE ALL ON cybersecurity_quiz.completions FROM anon;
GRANT SELECT ON cybersecurity_quiz.completions TO authenticated;
