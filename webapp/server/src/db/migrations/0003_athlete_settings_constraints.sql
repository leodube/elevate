-- 0003_athlete_settings_constraints.sql
-- Bug fix: nothing stopped two "since IS NULL" (forever) rows from
-- coexisting, which made AthleteSnapshotResolver's tie-break between them
-- effectively arbitrary - a newly added "current settings" entry could
-- silently lose to the original seeded default. There should only ever be
-- one "forever" entry (the current settings, until a dated one supersedes
-- it going forward), and at most one entry per specific start date.
--
-- Partial unique indexes let us enforce "unique among NULLs" and "unique
-- among non-NULLs" as two separate rules, which a plain UNIQUE constraint
-- on `since` can't do (SQL treats NULL <> NULL, so a plain UNIQUE
-- constraint would still allow multiple NULLs through).

-- Collapse any existing duplicate "forever" rows down to the most
-- recently created one before the constraint goes on, so this migration
-- doesn't fail against the bug it's fixing.
DELETE FROM athlete_dated_settings a
USING athlete_dated_settings b
WHERE a.since IS NULL
  AND b.since IS NULL
  AND a.id < b.id;

CREATE UNIQUE INDEX idx_athlete_dated_settings_forever_unique
  ON athlete_dated_settings ((since IS NULL))
  WHERE since IS NULL;

CREATE UNIQUE INDEX idx_athlete_dated_settings_since_unique
  ON athlete_dated_settings (since)
  WHERE since IS NOT NULL;
