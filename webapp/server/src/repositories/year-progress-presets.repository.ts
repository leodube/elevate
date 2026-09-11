import { pool } from "../db/pool";

export interface YearProgressPresetInput {
  id: string;
  mode: string; // "YEAR_TO_DATE" | "ROLLING" - ProgressMode enum key
  progressType: string; // "DISTANCE" | "TIME" | "ELEVATION" | "COUNT" - ProgressType enum key
  activityTypes: string[];
  includeCommuteRide: boolean;
  includeIndoorRide: boolean;
  targetValue: number | null;
  rollingPeriod: string | null;
  periodMultiplier: number | null;
}

export interface YearProgressPresetRow extends YearProgressPresetInput {
  createdAt: string;
}

export class YearProgressPresetsRepository {
  public async list(): Promise<YearProgressPresetRow[]> {
    const result = await pool.query(
      `SELECT id, mode, progress_type, activity_types, include_commute_ride, include_indoor_ride,
              target_value, rolling_period, period_multiplier, created_at
       FROM year_progress_presets
       ORDER BY created_at ASC`
    );
    return result.rows.map(toRow);
  }

  public async insert(input: YearProgressPresetInput): Promise<YearProgressPresetRow> {
    const result = await pool.query(
      `INSERT INTO year_progress_presets
         (id, mode, progress_type, activity_types, include_commute_ride, include_indoor_ride,
          target_value, rolling_period, period_multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, mode, progress_type, activity_types, include_commute_ride, include_indoor_ride,
                 target_value, rolling_period, period_multiplier, created_at`,
      [
        input.id,
        input.mode,
        input.progressType,
        input.activityTypes,
        input.includeCommuteRide,
        input.includeIndoorRide,
        input.targetValue,
        input.rollingPeriod,
        input.periodMultiplier
      ]
    );
    return toRow(result.rows[0]);
  }

  public async removeById(id: string): Promise<void> {
    await pool.query("DELETE FROM year_progress_presets WHERE id = $1", [id]);
  }
}

function toRow(row: any): YearProgressPresetRow {
  return {
    id: row.id,
    mode: row.mode,
    progressType: row.progress_type,
    activityTypes: row.activity_types ?? [],
    includeCommuteRide: row.include_commute_ride,
    includeIndoorRide: row.include_indoor_ride,
    targetValue: row.target_value,
    rollingPeriod: row.rolling_period,
    periodMultiplier: row.period_multiplier,
    createdAt: row.created_at
  };
}
