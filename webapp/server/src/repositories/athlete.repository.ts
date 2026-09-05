import { AthleteModel } from "@elevate/shared/models/athlete/athlete.model";
import { AthleteSettings } from "@elevate/shared/models/athlete/athlete-settings/athlete-settings.model";
import { DatedAthleteSettings } from "@elevate/shared/models/athlete/athlete-settings/dated-athlete-settings.model";
import { Gender } from "@elevate/shared/models/athlete/gender.enum";
import { PracticeLevel } from "@elevate/shared/models/athlete/athlete-level.enum";
import { ElevateSport } from "@elevate/shared/enums/elevate-sport.enum";
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

export interface AthleteModelInput {
  gender: Gender;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null; // YYYY-MM-DD
  practiceLevel: PracticeLevel | null;
  sports: ElevateSport[];
  datedAthleteSettings: DatedAthleteSettingsInput[];
}

export class AthleteRepository {
  /**
   * Assembles a real AthleteModel (real class instance, not a plain
   * object) from stored profile + dated settings, for feeding into
   * AthleteSnapshotResolver during compute, and for the client's
   * AthleteService.fetch() contract - the reused AthleteSettingsModule UI
   * calls methods like DatedAthleteSettings.isForever() on these objects,
   * which a plain JSON-shaped object wouldn't have.
   */
  public async getAthleteModel(): Promise<AthleteModel> {
    const profileResult = await pool.query(
      "SELECT gender, birth_date, first_name, last_name, practice_level, sports FROM athlete_profile WHERE id = 1"
    );
    const profileRow = profileResult.rows[0];
    const gender: Gender = profileRow?.gender === "women" ? Gender.WOMEN : Gender.MEN;
    const birthDate: Date | null = profileRow?.birth_date ?? null;
    const firstName: string | null = profileRow?.first_name ?? null;
    const lastName: string | null = profileRow?.last_name ?? null;
    const practiceLevel: PracticeLevel | null = profileRow?.practice_level ?? null;
    const sports: ElevateSport[] = profileRow?.sports ?? [];

    const datedAthleteSettings = await this.getDatedAthleteSettingsInstances();

    return new AthleteModel(
      gender,
      datedAthleteSettings.length > 0 ? datedAthleteSettings : [DatedAthleteSettings.DEFAULT_MODEL],
      firstName,
      lastName,
      birthDate,
      practiceLevel,
      sports
    );
  }

  /**
   * Wholesale replace, matching AthleteService.update()'s contract exactly:
   * the desktop UI (reused as-is) always sends the FULL AthleteModel,
   * including the complete datedAthleteSettings array after any
   * add/edit/remove - there's no granular per-entry endpoint on the
   * desktop side either, it's all in-memory array mutation + one save.
   * Transactional: profile fields update, all dated settings rows are
   * deleted and replaced with the given array, atomically.
   */
  public async replaceAthleteModel(input: AthleteModelInput): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE athlete_profile SET
           gender = $1, first_name = $2, last_name = $3, birth_date = $4,
           practice_level = $5, sports = $6, updated_at = now()
         WHERE id = 1`,
        [input.gender, input.firstName, input.lastName, input.birthDate, input.practiceLevel, input.sports]
      );

      await client.query("DELETE FROM athlete_dated_settings");

      for (const entry of input.datedAthleteSettings) {
        await client.query(
          `INSERT INTO athlete_dated_settings
            (since, max_hr, rest_hr, lthr_default, lthr_cycling, lthr_running, cycling_ftp, running_ftp, swim_ftp, weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            entry.since,
            entry.maxHr,
            entry.restHr,
            entry.lthrDefault,
            entry.lthrCycling,
            entry.lthrRunning,
            entry.cyclingFtp,
            entry.runningFtp,
            entry.swimFtp,
            entry.weight
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  private async getDatedAthleteSettingsInstances(): Promise<DatedAthleteSettings[]> {
    const result = await pool.query(
      `SELECT since, max_hr, rest_hr, lthr_default, lthr_cycling, lthr_running,
              cycling_ftp, running_ftp, swim_ftp, weight
       FROM athlete_dated_settings ORDER BY since DESC NULLS LAST`
    );
    return result.rows.map(row => {
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
  }

  private toDateOnlyString(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;
  }
}
