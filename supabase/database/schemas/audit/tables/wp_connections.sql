-- One row per WordPress site running the Audit Hub plugin, per environment:
-- staging and production each have their own database and so their own rows,
-- keys and secrets. Nothing here is shared between environments.
--
-- Two secrets, one for each direction:
--   key_hash        sha256 (hex) of the key the plugin sends as
--                   `Authorization: Bearer …` when it calls /api/audit/wp/*.
--                   Only the hash is stored; the key itself is printed once by
--                   scripts/audit-wp-key.mjs and pasted into the plugin.
--   webhook_secret  HMAC-SHA256 key the status trigger signs its webhooks with
--                   (functions/wp_notify_status.sql). Stored in the clear
--                   because the database has to sign with it; the plugin
--                   receives it from /api/audit/wp/connect, never by hand.
--
-- webhook_url is written by the plugin on connect (its own REST endpoint), so
-- it follows the site rather than being typed in here.
CREATE TABLE audit.wp_connections (
  domain          text                     NOT NULL,
  key_hash        text                     NOT NULL,
  webhook_secret  text                     NOT NULL,
  webhook_url     text,
  enabled         boolean                  DEFAULT true NOT NULL,
  plugin_version  text,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at    timestamp with time zone
);

ALTER TABLE audit.wp_connections
  OWNER TO payload_app;

ALTER TABLE audit.wp_connections
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.wp_connections
  ADD CONSTRAINT wp_connections_pkey PRIMARY KEY (domain);

-- Every plugin request is looked up by the hash of its bearer key.
ALTER TABLE audit.wp_connections
  ADD CONSTRAINT wp_connections_key_hash_key UNIQUE (key_hash);

-- Deliberately no grants to authenticated or service_role, unlike the other
-- audit tables: this one holds secrets, and only the app (payload_app, the
-- owner) and the status trigger (SECURITY DEFINER as postgres) read it.
