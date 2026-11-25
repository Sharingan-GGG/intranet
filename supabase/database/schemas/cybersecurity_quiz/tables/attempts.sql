-- One row per submitted attempt (StoredAttempt). Never updated: a retry is a new row.
CREATE TABLE IF NOT EXISTS cybersecurity_quiz.attempts (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          varchar      NOT NULL,          -- public.users.id (Payload user id)
  quiz_version     text         NOT NULL,          -- e.g. '2026.1'; a new version = everyone due again
  started_at       timestamptz  NOT NULL,
  completed_at     timestamptz,
  answers          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  correct_count    integer      NOT NULL,
  total            integer      NOT NULL,
  score            numeric(5,4) NOT NULL,          -- 0.0000 to 1.0000
  passed           boolean      NOT NULL,
  per_question     jsonb        NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key  uuid         UNIQUE,            -- not wired up yet, see src/app/security-quiz/README.md
  created_at       timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT attempts_quiz_version_format CHECK (quiz_version ~ '^[A-Za-z0-9.-]{1,50}$'),
  CONSTRAINT attempts_counts_valid        CHECK (total >= 0 AND correct_count BETWEEN 0 AND total),
  CONSTRAINT attempts_score_range         CHECK (score BETWEEN 0 AND 1),
  CONSTRAINT attempts_score_matches       CHECK (
    (total = 0 AND score = 0) OR (total > 0 AND abs(score - correct_count::numeric / total) < 0.0001)
  ),
  CONSTRAINT attempts_passed_needs_finish CHECK (NOT passed OR completed_at IS NOT NULL),
  CONSTRAINT attempts_time_order          CHECK (completed_at IS NULL OR completed_at >= started_at),
  CONSTRAINT attempts_answers_is_object   CHECK (jsonb_typeof(answers) = 'object'),
  CONSTRAINT attempts_per_question_array  CHECK (jsonb_typeof(per_question) = 'array')
);

ALTER TABLE cybersecurity_quiz.attempts OWNER TO payload_app;

COMMENT ON TABLE cybersecurity_quiz.attempts IS
  'One row per submitted quiz attempt. Written only by the intranet server. Never updated.';

CREATE INDEX IF NOT EXISTS attempts_version_user_idx
  ON cybersecurity_quiz.attempts (quiz_version, user_id, completed_at);

-- RESTRICT: a user with quiz history can't be hard-deleted (audit evidence, PCI DSS 12.6).
ALTER TABLE cybersecurity_quiz.attempts DROP CONSTRAINT IF EXISTS attempts_user_fk;
ALTER TABLE cybersecurity_quiz.attempts
  ADD CONSTRAINT attempts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE cybersecurity_quiz.attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cybersecurity_quiz.attempts FROM anon;
GRANT SELECT ON cybersecurity_quiz.attempts TO authenticated;

DROP POLICY IF EXISTS "Staff read own attempts" ON cybersecurity_quiz.attempts;
CREATE POLICY "Staff read own attempts" ON cybersecurity_quiz.attempts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::text = user_id);
