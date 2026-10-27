-- 0004_athlete_profile_extended.sql
-- The "About Me" form (reused directly from desktop's AthleteSettingsComponent)
-- edits the full AthleteModel: gender, birthDate, firstName, lastName,
-- practiceLevel, sports[] - athlete_profile only had gender/birth_date so far.

ALTER TABLE athlete_profile
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT,
  ADD COLUMN practice_level TEXT,
  ADD COLUMN sports TEXT[] NOT NULL DEFAULT '{}';
