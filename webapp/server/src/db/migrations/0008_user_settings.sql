-- 0008_user_settings.sql
-- Persists Global Settings server-side (webapp only). Singleton row
-- (id = 1), same pattern as athlete_profile/user_zones.
--
-- Scoped to exactly the 4 BaseUserSettings fields the webapp Global
-- Settings page actually exposes - GlobalSettingsService.sections filters
-- by buildTarget, and every other section in that file is tagged
-- DESKTOP-only (map settings) or EXTENSION-only (Strava-page overlay
-- toggles, dashboard feed filters, etc.) - none of that applies to a
-- standalone webapp, so there's nothing to persist for it.

CREATE TABLE user_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- MeasureSystem enum value ("metric" | "imperial")
  system_unit TEXT NOT NULL DEFAULT 'metric' CHECK (system_unit IN ('metric', 'imperial')),

  -- Temperature enum value ("C" | "F") - matches the enum's own wire
  -- values exactly (it's already a stable string enum, unlike
  -- ProgressMode/ProgressType back in year_progress_presets)
  temperature_unit TEXT NOT NULL DEFAULT 'C' CHECK (temperature_unit IN ('C', 'F')),

  disable_missing_stress_scores_warning BOOLEAN NOT NULL DEFAULT false,
  disable_activities_need_recalculation_warning BOOLEAN NOT NULL DEFAULT false,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO user_settings (id) VALUES (1);
