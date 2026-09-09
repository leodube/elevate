import { pool } from "../db/pool";

export interface ActivitiesViewPreferences {
  selectedSports: string[];
  // null = no saved selection yet, client should fall back to its own
  // default columns - distinct from an empty array (a real, if unusual,
  // saved selection of zero columns).
  selectedColumns: string[] | null;
}

/**
 * Single-user app, so this is a singleton row (id = 1) rather than
 * per-user rows - same pattern as IntervalsSettingsRepository /
 * AthleteRepository's profile half.
 */
export class ActivitiesViewPreferencesRepository {
  public async get(): Promise<ActivitiesViewPreferences> {
    const result = await pool.query(
      "SELECT selected_sports, selected_columns FROM activities_view_preferences WHERE id = 1"
    );
    const row = result.rows[0];
    return {
      selectedSports: row?.selected_sports ?? [],
      selectedColumns: row?.selected_columns ?? null
    };
  }

  public async updateSelectedSports(sports: string[]): Promise<void> {
    await pool.query(
      "UPDATE activities_view_preferences SET selected_sports = $1, updated_at = now() WHERE id = 1",
      [sports]
    );
  }

  public async updateSelectedColumns(columnIds: string[]): Promise<void> {
    await pool.query(
      "UPDATE activities_view_preferences SET selected_columns = $1, updated_at = now() WHERE id = 1",
      [columnIds]
    );
  }
}
