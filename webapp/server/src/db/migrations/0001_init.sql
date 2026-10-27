-- 0001_init.sql
-- Core schema: computed activities, and singleton settings for the
-- intervals.icu connector (this is a single-user app - no accounts table).

CREATE TABLE activities (
  -- intervals.icu's own activity id. Kept as TEXT to be safe regardless
  -- of whether it's numeric or string-prefixed - confirm exact format
  -- against a real API response when the connector is built, but TEXT
  -- is a safe superset either way.
  id TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  type TEXT NOT NULL, -- ElevateSport enum value, stored as its string name

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  start_timestamp BIGINT NOT NULL,
  end_timestamp BIGINT NOT NULL,

  has_power_meter BOOLEAN NOT NULL DEFAULT FALSE,
  trainer BOOLEAN NOT NULL DEFAULT FALSE,
  commute BOOLEAN NOT NULL DEFAULT FALSE,
  manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_swim_pool BOOLEAN,
  auto_detected_type BOOLEAN NOT NULL DEFAULT FALSE,
  settings_lack BOOLEAN,

  device TEXT,
  notes TEXT,
  flags SMALLINT[], -- ActivityFlag enum values; NULL means user cleared all flags
  lat_lng_center DOUBLE PRECISION[],

  -- Fingerprint used for change detection / dedup during sync, mirroring
  -- the desktop connector's use of Activity.hash.
  hash TEXT NOT NULL,

  creation_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_edit_time TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Large/nested computed structures kept as JSONB rather than normalized -
  -- these mirror ActivityStats/AthleteSnapshot/Lap[] directly from
  -- @elevate/shared and are consumed as whole documents, not queried
  -- field-by-field, so normalizing them would add a lot of tables for no
  -- real benefit.
  athlete_snapshot JSONB NOT NULL,
  stats JSONB NOT NULL,
  src_stats JSONB,
  laps JSONB,
  extras JSONB,

  -- Stream data, compressed the same way the desktop app already does via
  -- Streams.deflate()/inflate() (LZString to base64). NULL if streams
  -- haven't been fetched for this activity yet.
  streams_deflated TEXT
);

CREATE INDEX idx_activities_start_time ON activities (start_time DESC);
CREATE INDEX idx_activities_type ON activities (type);

-- Singleton settings row (id is always 1) for the intervals.icu connector.
-- Configured via the webapp's Connectors settings page, not env vars,
-- since it's meant to be user-editable at runtime.
CREATE TABLE intervals_connector_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  api_key TEXT,
  athlete_id TEXT,

  -- Incremental sync watermark - the startTimestamp of the most recently
  -- synced activity, matching the "sync from most recent" strategy agreed
  -- on for this connector.
  last_synced_start_timestamp BIGINT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
