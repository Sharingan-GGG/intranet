-- Push a page's audit status to its WordPress site when it changes.
--
-- The workers write content_audits / seo_agent_tracker straight into Postgres,
-- so the intranet itself never sees a run finish — the only place that does is
-- the database. This trigger sends a small signed POST (via pg_net, which
-- queues it and sends after commit, so the worker's write is never slowed or
-- rolled back by a slow WordPress) to the plugin endpoint the site registered
-- in audit.wp_connections. Sites with no connection row cost one index lookup.
--
-- Body (jsonb, so the signed text is exactly what pg_net sends):
--   { domain, url, kind: 'audit' | 'full_scan', status, label, at }
-- `status`/`label` use the Audit Hub's own vocabulary (audit-types.ts):
--   audit:      queued | running | done | error   ("none" when the row is gone)
--   full_scan:  not-started | scheduled | in-progress | in-review | done | error
--               ("none" when the page leaves the Full Scan list)
-- Headers:
--   X-Audit-Hub-Timestamp  unix seconds
--   X-Audit-Hub-Signature  hex HMAC-SHA256 of "<timestamp>.<body>" with webhook_secret
--
-- SECURITY DEFINER (owned by postgres) because the workers' role may not be able
-- to read wp_connections or call net.http_post; search_path is pinned empty and
-- every name below is schema-qualified.
CREATE OR REPLACE FUNCTION audit.wp_notify_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  rec      record;
  v_domain text;
  v_kind   text;
  v_status text;
  v_label  text;
  v_at     timestamptz;
  conn     record;
  body     jsonb;
  ts       text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;

  IF TG_TABLE_NAME = 'content_audits' THEN
    v_domain := rec.domain;
    v_kind   := 'audit';
    v_status := CASE WHEN TG_OP = 'DELETE' THEN 'none' ELSE rec.status END;
    v_label  := CASE v_status
                  WHEN 'queued'  THEN 'Queued'
                  WHEN 'running' THEN 'Auditing'
                  WHEN 'done'    THEN 'Done'
                  WHEN 'error'   THEN 'Failed'
                  ELSE 'Not Started'
                END;
    v_at     := CASE WHEN TG_OP = 'DELETE' THEN now()
                     ELSE coalesce(rec.finished_at, rec.started_at, rec.queued_at) END;
  ELSE
    v_domain := rec."Domain";
    v_kind   := 'full_scan';
    v_status := CASE WHEN TG_OP = 'DELETE' THEN 'none'
                  ELSE CASE rec.status::text
                         WHEN 'Not Yet Started' THEN 'not-started'
                         WHEN 'Scheduled'       THEN 'scheduled'
                         WHEN 'In Progress'     THEN 'in-progress'
                         WHEN 'In Review'       THEN 'in-review'
                         WHEN 'Done'            THEN 'done'
                         WHEN 'Error'           THEN 'error'
                         ELSE 'not-started'
                       END
                END;
    v_label  := CASE v_status
                  WHEN 'scheduled'   THEN 'Scheduled'
                  WHEN 'in-progress' THEN 'In Progress'
                  WHEN 'in-review'   THEN 'In Review'
                  WHEN 'done'        THEN 'Done'
                  WHEN 'error'       THEN 'Error'
                  ELSE 'Not Started'
                END;
    v_at     := CASE WHEN TG_OP = 'DELETE' THEN now()
                     ELSE coalesce(rec.finished_at, rec.started_at, rec.created_at) END;
  END IF;

  IF v_domain IS NULL OR rec.url IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.webhook_url, c.webhook_secret
    INTO conn
    FROM audit.wp_connections c
   WHERE c.domain = v_domain
     AND c.enabled
     AND c.webhook_url IS NOT NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  body := jsonb_build_object(
    'domain', v_domain,
    'url',    rec.url,
    'kind',   v_kind,
    'status', v_status,
    'label',  v_label,
    'at',     v_at
  );
  ts := extract(epoch FROM now())::bigint::text;

  PERFORM net.http_post(
    url     := conn.webhook_url,
    body    := body,
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'X-Audit-Hub-Timestamp', ts,
      'X-Audit-Hub-Signature',
        encode(extensions.hmac(ts || '.' || body::text, conn.webhook_secret, 'sha256'), 'hex')
    ),
    timeout_milliseconds := 5000
  );

  RETURN NULL;
END;
$$;

ALTER FUNCTION audit.wp_notify_status() OWNER TO postgres;

REVOKE ALL ON FUNCTION audit.wp_notify_status() FROM PUBLIC;

DROP TRIGGER IF EXISTS content_audits_wp_notify ON audit.content_audits;
CREATE TRIGGER content_audits_wp_notify
  AFTER INSERT OR DELETE OR UPDATE OF status ON audit.content_audits
  FOR EACH ROW EXECUTE FUNCTION audit.wp_notify_status();

DROP TRIGGER IF EXISTS seo_agent_tracker_wp_notify ON audit.seo_agent_tracker;
CREATE TRIGGER seo_agent_tracker_wp_notify
  AFTER INSERT OR DELETE OR UPDATE OF status ON audit.seo_agent_tracker
  FOR EACH ROW EXECUTE FUNCTION audit.wp_notify_status();
