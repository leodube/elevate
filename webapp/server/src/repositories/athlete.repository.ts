import { AthleteModel } from "@elevate/shared/models/athlete/athlete.model";
import { AthleteSettings } from "@elevate/shared/models/athlete/athlete-settings/athlete-settings.model";
import { DatedAthleteSettings } from "@elevate/shared/models/athlete/athlete-settings/dated-athlete-settings.model";
import { Gender } from "@elevate/shared/models/athlete/gender.enum";
import { pool } from "../db/pool";

export interface DatedAthleteSettingsInput {
  since: string | null; // YYYY-MM-DD or null for "forever"
  maxHr: number | null;
  restHr: number | null;
  lthrDefault: number | null;
  lthrCycling: number | null;
  lthrRunning: number | null;
  cyclingFtp: number | null;
  runningFtp: number | null;
  swimFtp: number | null;
  weight: number | null;
}

export class AthleteRepository {
  /**
   * Assembles a real AthleteModel from stored profile + dated settings,
   * for feeding into AthleteSnapshotResolver during compute. Falls back to
   * AthleteModel.DEFAULT_MODEL pieces wherever data is missing, same as
   * the shared model's own defaults.
   */
  public async getAthleteModel(): Promise<AthleteModel> {
    const profileResult = await pool.query(
      "SELECT gender, birth_date FROM athlete_profile WHERE id = 1"
    );
    const profileRow = profileResult.rows[0];
    const gender: Gender = profileRow?.gender === "women" ? Gender.WOMEN : Gender.MEN;
    const birthDate: Date | null = profileRow?.birth_date ?? null;

    const settingsResult = await pool.query(
      `SELECT since, max_hr, rest_hr, lthr_default, lthr_cycling, lthr_running,
              cycling_ftp, running_ftp, swim_ftp, weight
       FROM athlete_dated_settings ORDER BY since DESC NULLS LAST`
    );

    const datedAthleteSettings: DatedAthleteSettings[] = settingsResult.rows.map((row) => {
      const settings = new AthleteSettings(
        row.max_hr,
        row.rest_hr,
        { default: row.lthr_default, cycling: row.lthr_cycling, running: row.lthr_running },
        row.cycling_ftp,
        row.running_ftp,
        row.swim_ftp,
        row.weight
      );
      const since = row.since ? this.toDateOnlyString(row.since) : null;
      return new DatedAthleteSettings(since, settings);
    });

    return new AthleteModel(
      gender,
      datedAthleteSettings.length > 0 ? datedAthleteSettings : [DatedAthleteSettings.DEFAULT_MODEL],
      null,
      null,
      birthDate,
      null,
      []
    );
  }

  public async updateProfile(gender: Gender, birthDate: string | null): Promise<void> {
    await pool.query(
      `UPDATE athlete_profile SET gender = $1, birth_date = $2, updated_at = now() WHERE id = 1`,
      [gender, birthDate]
    );
  }

  public async listDatedSettings(): Promise<DatedAthleteSettingsInput[]> {
    const result = await pool.query(
      `SELECT since, max_hr, rest_hr, lthr_default, lthr_cycling, lthr_running,
              cycling_ftp, running_ftp, swim_ftp, weight
       FROM athlete_dated_settings ORDER BY since DESC NULLS LAST`
    );
    return result.rows.map((row) => ({
      since: row.since ? this.toDateOnlyString(row.since) : null,
      maxHr: row.max_hr,
      restHr: row.rest_hr,
      lthrDefault: row.lthr_default,
      lthrCycling: row.lthr_cycling,
      lthrRunning: row.lthr_running,
      cyclingFtp: row.cycling_ftp,
      runningFtp: row.running_ftp,
      swimFtp: row.swim_ftp,
      weight: row.weight,
    }));
  }

  /**
   * Adds or replaces a dated settings entry for the given `since` period.
   * Upserts rather than blind-inserting: a second "forever" (since = null)
   * entry, or a second entry for the same specific date, replaces the
   * existing one instead of creating an ambiguous duplicate that
   * AthleteSnapshotResolver would have to arbitrarily tie-break between.
   */
  public async addDatedSettings(input: DatedAthleteSettingsInput): Promise<void> {
    const conflictTarget = input.since === null ? "((since IS NULL)) WHERE since IS NULL" : "(since)";
    await pool.query(
      `INSERT INTO athlete_dated_settings
        (since, max_hr, rest_hr, lthr_default, lthr_cycling, lthr_running, cycling_ftp, running_ftp, swim_ftp, weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ${conflictTarget} DO UPDATE SET
         max_hr = EXCLUDED.max_hr,
         rest_hr = EXCLUDED.rest_hr,
         lthr_default = EXCLUDED.lthr_default,
         lthr_cycling = EXCLUDED.lthr_cycling,
         lthr_running = EXCLUDED.lthr_running,
         cycling_ftp = EXCLUDED.cycling_ftp,
         running_ftp = EXCLUDED.running_ftp,
         swim_ftp = EXCLUDED.swim_ftp,
         weight = EXCLUDED.weight,
         updated_at = now()`,
      [
        input.since,
        input.maxHr,
        input.restHr,
        input.lthrDefault,
        input.lthrCycling,
        input.lthrRunning,
        input.cyclingFtp,
        input.runningFtp,
        input.swimFtp,
        input.weight,
      ]
    );
  }

  private toDateOnlyString(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;
  }
}
