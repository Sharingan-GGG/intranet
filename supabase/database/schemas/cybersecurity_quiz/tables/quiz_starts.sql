-- "This person has opened this version" (QuizOpenEvent). One row per person per version;
-- inserts use ON CONFLICT DO NOTHING so the FIRST start time is kept.
CREATE TABLE IF NOT EXISTS cybersecurity_quiz.quiz_starts (
  user_id       varchar     NOT NULL,
  quiz_version  text        NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, quiz_version),
  CONSTRAINT quiz_starts_quiz_version_format CHECK (quiz_version ~ '^[A-Za-z0-9.-]{1,50}$')
);

ALTER TABLE cybersecurity_quiz.quiz_starts OWNER TO payload_app;

COMMENT ON TABLE cybersecurity_quiz.quiz_starts IS
  'First time each user opened each quiz version. Used to show "in progress" in the report.';

ALTER TABLE cybersecurity_quiz.quiz_starts DROP CONSTRAINT IF EXISTS quiz_starts_user_fk;
ALTER TABLE cybersecurity_quiz.quiz_starts
  ADD CONSTRAINT quiz_starts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE cybersecurity_quiz.quiz_starts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cybersecurity_quiz.quiz_starts FROM anon;
GRANT SELECT ON cybersecurity_quiz.quiz_starts TO authenticated;

DROP POLICY IF EXISTS "Staff read own starts" ON cybersecurity_quiz.quiz_starts;
CREATE POLICY "Staff read own starts" ON cybersecurity_quiz.quiz_starts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::text = user_id);
