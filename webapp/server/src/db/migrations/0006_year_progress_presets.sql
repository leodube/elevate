-- 0006_year_progress_presets.sql
-- Persists Year Progress presets server-side (webapp only - desktop/
-- extension keep using their local LokiJS-backed YearProgressPresetDao).
-- Unlike athlete_profile/activities_view_preferences, this is a genuine
-- multi-row list keyed by the client's own id (Identifier.generate(), a
-- 16-char base36 string - not a Postgres-assigned uuid/serial), since the
-- client always constructs the full preset (including id) before calling
-- insert().

CREATE TABLE year_progress_presets (
  id TEXT PRIMARY KEY,

  -- ProgressMode/ProgressType are plain numeric TS enums with no
  -- explicit values - their numeric ordinals are just compiler-assigned
  -- declaration order, not a stable wire contract. Storing the enum's
  -- string key (via TS's built-in reverse mapping, e.g. ProgressType[0]
  -- === "DISTANCE") instead of the raw number means inserting/reordering
  -- an enum member later can't silently reinterpret already-stored rows.
  mode TEXT NOT NULL CHECK (mode IN ('YEAR_TO_DATE', 'ROLLING')),
  progress_type TEXT NOT NULL CHECK (progress_type IN ('DISTANCE', 'TIME', 'ELEVATION', 'COUNT')),

  -- ElevateSport enum values (strings already, same as activities.type)
  activity_types TEXT[] NOT NULL,

  include_commute_ride BOOLEAN NOT NULL,
  include_indoor_ride BOOLEAN NOT NULL,
  target_value DOUBLE PRECISION,

  -- Only set when mode = 'ROLLING'
  rolling_period TEXT,
  period_multiplier INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
