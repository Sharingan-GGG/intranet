-- One-time codes behind the WordPress plugin's "Connect" button.
--
-- The plugin sends the browser to /audit/wp-connect. Someone signed into the
-- intranet with Audit Hub access approves it, and the browser goes back to
-- WordPress carrying a code. WordPress's server then trades the code for a site
-- key at /api/audit/wp/exchange, so the key itself never passes through a
-- browser, a URL or anyone's clipboard.
--
-- Same shape as OAuth's authorization code with PKCE:
--   code_hash   sha256 (hex) of the code; the code is only ever in the redirect
--   challenge   base64url(sha256(verifier)) — the verifier never leaves the WP
--               server until the exchange, so a code read out of a log or the
--               browser history is useless on its own
--   expires_at  10 minutes; used_at makes it single-use
CREATE TABLE audit.wp_connect_codes (
  code_hash   text                     NOT NULL,
  domain      text                     NOT NULL,
  challenge   text                     NOT NULL,
  created_by  text                     NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  expires_at  timestamp with time zone NOT NULL,
  used_at     timestamp with time zone
);

ALTER TABLE audit.wp_connect_codes
  OWNER TO payload_app;

ALTER TABLE audit.wp_connect_codes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.wp_connect_codes
  ADD CONSTRAINT wp_connect_codes_pkey PRIMARY KEY (code_hash);

-- No grants beyond the owner: only the app reads or writes these.
