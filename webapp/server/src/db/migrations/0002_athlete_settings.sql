-- 0002_athlete_settings.sql
-- Athlete profile + dated settings, mirroring @elevate/shared's
-- AthleteModel/DatedAthleteSettings so AthleteSnapshotResolver can be fed
-- real data instead of AthleteModel.DEFAULT_MODEL.

-- Singleton profile row (id always 1) - gender and birth date, used for
-- age-based calculations in AthleteSnapshotResolver.resolve().
CREATE TABLE athlete_profile (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gender TEXT NOT NULL DEFAULT 'men' CHECK (gender IN ('men', 'women')),
  birth_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO athlete_profile (id) VALUES (1);

-- Multiple rows, one per settings period - equivalent to desktop's
-- AthleteModel.datedAthleteSettings[]. A NULL "since" means "forever" /
-- the earliest-applicable entry, matching DatedAthleteSettings.since's
-- documented meaning in @elevate/shared.
CREATE TABLE athlete_dated_settings (
  id SERIAL PRIMARY KEY,

  -- NULL = applies from the beginning of time until superseded by a
  -- dated entry. Only one row should have since = NULL in practice
  -- (enforced at the application layer, not the DB, since desktop's own
  -- model doesn't enforce it either).
  since DATE,

  max_hr INTEGER,
  rest_hr INTEGER,
  lthr_default INTEGER,
  lthr_cycling INTEGER,
  lthr_running INTEGER,
  cycling_ftp INTEGER,
  running_ftp INTEGER,
  swim_ftp INTEGER,
  weight REAL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_athlete_dated_settings_since ON athlete_dated_settings (since);

-- Seed with AthleteSettings.DEFAULT_MODEL equivalents (since = NULL,
-- "forever") so a resolver built from this table always has at least one
-- entry to fall back to, same as the shared model's own default.
INSERT INTO athlete_dated_settings (since, max_hr, rest_hr, weight)
VALUES (NULL, 190, 65, 70);
