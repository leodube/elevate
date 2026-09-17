import { pool } from "../db/pool";

export interface IntervalsConnectorSettings {
  apiKey: string | null;
  athleteId: string | null;
  lastSyncedStartTimestamp: number | null;
  lastSyncedAt: Date | null;
}

export class IntervalsSettingsRepository {
  public async get(): Promise<IntervalsConnectorSettings | null> {
    const result = await pool.query(
      `SELECT api_key, athlete_id, last_synced_start_timestamp, last_synced_at
       FROM intervals_connector_settings WHERE id = 1`
    );
    if (result.rowCount === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      apiKey: row.api_key,
      athleteId: row.athlete_id,
      lastSyncedStartTimestamp: row.last_synced_start_timestamp,
      lastSyncedAt: row.last_synced_at,
    };
  }

  public async upsertCredentials(apiKey: string, athleteId: string | null): Promise<void> {
    await pool.query(
      `INSERT INTO intervals_connector_settings (id, api_key, athlete_id)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET
         api_key = EXCLUDED.api_key,
         athlete_id = EXCLUDED.athlete_id,
         updated_at = now()`,
      [apiKey, athleteId]
    );
  }

  public async updateWatermark(startTimestamp: number): Promise<void> {
    await pool.query(
      `UPDATE intervals_connector_settings
       SET last_synced_start_timestamp = $1, last_synced_at = now(), updated_at = now()
       WHERE id = 1`,
      [startTimestamp]
    );
  }
}
