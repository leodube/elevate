-- 0005_activities_view_preferences.sql
-- Persists the activities table's "Filter by sports" and "Columns
-- displayed" selections server-side (webapp only - desktop/extension keep
-- using localStorage), so a view survives across sessions/devices instead
-- of resetting on every fresh session. Same singleton-row pattern as
-- intervals_connector_settings / athlete_profile: this is a single-user
-- app, so there's exactly one "current view" rather than per-user rows.

CREATE TABLE activities_view_preferences (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- ElevateSport enum values (strings), matching Preferences.sports on the
  -- client. Empty array means "no sport filter applied" - same meaning as
  -- the client's default Preferences.sports = [].
  selected_sports TEXT[] NOT NULL DEFAULT '{}',

  -- ActivityColumns.Column ids. NULL (not empty array) means "no saved
  -- selection yet - use the client's default columns", mirroring
  -- ActivitiesComponent.getSelectedColumns() returning null today when
  -- localStorage has nothing saved. An empty array is a real (if
  -- degenerate) saved selection and is left alone rather than treated as
  -- "unset".
  selected_columns TEXT[],

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO activities_view_preferences (id) VALUES (1);
