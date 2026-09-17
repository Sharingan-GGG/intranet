-- One row per property per day: the nightly GA4 snapshot the traffic screen
-- reads. Daily grain rather than a rolling total so trends stay possible
-- without a second ingest.
CREATE TABLE audit.ga4_daily (
  property_id          text                     NOT NULL,
  date                 date                     NOT NULL,
  active_users         integer                  DEFAULT 0 NOT NULL,
  new_users            integer                  DEFAULT 0 NOT NULL,
  sessions             integer                  DEFAULT 0 NOT NULL,
  engaged_sessions     integer                  DEFAULT 0 NOT NULL,
  -- Rates and averages are stored as GA reported them *for that day*. Never sum
  -- or average these across days: the reader re-derives both over the window
  -- from the counts, because averaging daily rates is wrong whenever daily
  -- traffic is uneven.
  engagement_rate      numeric,
  avg_session_duration numeric,
  screen_page_views    integer                  DEFAULT 0 NOT NULL,
  fetched_at           timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE audit.ga4_daily
  OWNER TO payload_app;

ALTER TABLE audit.ga4_daily
  ENABLE ROW LEVEL SECURITY;

-- (property_id, date) is the ON CONFLICT target for the nightly upsert, so this
-- key is load-bearing: the job re-pulls a trailing window every night because
-- GA4 figures are not final for ~48h, and those re-pulls must overwrite the
-- provisional rows rather than append duplicates.
ALTER TABLE audit.ga4_daily
  ADD CONSTRAINT ga4_daily_pkey PRIMARY KEY (property_id, date);

ALTER TABLE audit.ga4_daily
  ADD CONSTRAINT ga4_daily_property_fkey
  FOREIGN KEY (property_id) REFERENCES audit.ga4_properties (property_id) ON DELETE CASCADE;

CREATE INDEX ga4_daily_date_idx ON audit.ga4_daily (date DESC);

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.ga4_daily TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON audit.ga4_daily TO service_role;
