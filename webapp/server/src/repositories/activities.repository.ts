import { Activity } from "@elevate/shared/models/sync/activity.model";
import { pool } from "../db/pool";

export interface ActivityListFilters {
  type?: string;
  since?: Date;
  until?: Date;
  limit: number;
  offset: number;
}

export interface ActivityListItem {
  id: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  startTimestamp: number;
  endTimestamp: number;
  hasPowerMeter: boolean;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  settingsLack: boolean | null;
  athleteSnapshot: unknown;
  stats: unknown;
  srcStats: unknown;
}

export interface ActivityDetail extends Activity {
  streamsAvailable: boolean;
}

export interface ActivitySportsSummaryItem {
  type: string;
  count: number;
}

export class ActivitiesRepository {
  /**
   * Used for incremental sync dedup, mirroring the desktop connector's
   * findLocalActivities() check.
   */
  public async exists(activityId: string): Promise<boolean> {
    const result = await pool.query("SELECT 1 FROM activities WHERE id = $1", [activityId]);
    return result.rowCount > 0;
  }

  /**
   * Distinct activity types with counts, for the activities view's "Filter
   * by sports" dropdown. A dedicated query (GROUP BY on the whole table)
   * rather than deriving the list from whatever page of activities the
   * client currently has loaded - the dropdown should list every sport
   * ever synced, not just the ones present in the current page/limit, and
   * this stays correct if/when list() grows real server-side pagination.
   * Ordered by count desc, matching desktop's ActivityService.countByType().
   */
  public async getSportsSummary(): Promise<ActivitySportsSummaryItem[]> {
    const result = await pool.query(
      "SELECT type, count(*)::int AS count FROM activities GROUP BY type ORDER BY count DESC"
    );
    return result.rows.map((row) => ({ type: row.type, count: row.count }));
  }

  /**
   * Lightweight list for the activities view - deliberately excludes the
   * heavy stats/laps/streams JSON blobs, pulling just what's needed to
   * pick out (distance/moving time) from the stats jsonb without shipping
   * the whole document per row.
   */
  public async list(filters: ActivityListFilters): Promise<{ items: ActivityListItem[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      params.push(filters.type);
      conditions.push(`type = $${params.length}`);
    }
    if (filters.since) {
      params.push(filters.since);
      conditions.push(`start_time >= $${params.length}`);
    }
    if (filters.until) {
      params.push(filters.until);
      conditions.push(`start_time <= $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(`SELECT count(*) FROM activities ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(filters.limit);
    params.push(filters.offset);
    const itemsResult = await pool.query(
      `SELECT id, name, type, start_time, end_time, start_timestamp, end_timestamp,
              has_power_meter, trainer, commute, manual, settings_lack,
              athlete_snapshot, stats, src_stats
       FROM activities ${where}
       ORDER BY start_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items: ActivityListItem[] = itemsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      startTime: row.start_time.toISOString(),
      endTime: row.end_time.toISOString(),
      startTimestamp: row.start_timestamp,
      endTimestamp: row.end_timestamp,
      hasPowerMeter: row.has_power_meter,
      trainer: row.trainer,
      commute: row.commute,
      manual: row.manual,
      settingsLack: row.settings_lack,
      athleteSnapshot: row.athlete_snapshot,
      stats: row.stats,
      srcStats: row.src_stats,
    }));

    return { items, total };
  }

  /**
   * Full detail for a single activity, including the athlete snapshot,
   * full stats/laps/extras. Streams are NOT included here - use
   * getStreams() separately, since the deflated blob can be sizeable and
   * a detail view (charts/summary) doesn't always need it immediately.
   */
  public async getById(activityId: string): Promise<ActivityDetail | null> {
    const result = await pool.query(
      `SELECT id, name, type, start_time, end_time, start_timestamp, end_timestamp,
              has_power_meter, trainer, commute, manual, is_swim_pool, auto_detected_type,
              settings_lack, device, notes, flags, lat_lng_center, hash,
              athlete_snapshot, stats, src_stats, laps, extras,
              (streams_deflated IS NOT NULL) as streams_available
       FROM activities WHERE id = $1`,
      [activityId]
    );
    if (result.rowCount === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      startTime: row.start_time.toISOString(),
      endTime: row.end_time.toISOString(),
      startTimestamp: row.start_timestamp,
      endTimestamp: row.end_timestamp,
      hasPowerMeter: row.has_power_meter,
      trainer: row.trainer,
      commute: row.commute,
      manual: row.manual,
      isSwimPool: row.is_swim_pool,
      autoDetectedType: row.auto_detected_type,
      settingsLack: row.settings_lack,
      device: row.device,
      notes: row.notes,
      flags: row.flags,
      latLngCenter: row.lat_lng_center,
      hash: row.hash,
      athleteSnapshot: row.athlete_snapshot,
      stats: row.stats,
      srcStats: row.src_stats,
      laps: row.laps,
      extras: row.extras,
      streamsAvailable: row.streams_available,
    } as ActivityDetail;
  }

  /**
   * Returns the raw deflated stream string as stored - the client inflates
   * it itself via Streams.inflate() from @elevate/shared, which is
   * plain LZString + JSON.parse and works fine in a browser. Sending it
   * still-compressed keeps the response smaller than re-inflating
   * server-side and shipping raw arrays over the wire.
   */
  public async getStreamsDeflated(activityId: string): Promise<string | null> {
    const result = await pool.query("SELECT streams_deflated FROM activities WHERE id = $1", [
      activityId,
    ]);
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0].streams_deflated;
  }

  /**
   * Full activity shape suitable for feeding back into
   * ActivityComputeProcessor.compute() during recalculation - same query
   * as getById() minus the streamsAvailable flag, returned as a plain
   * Activity rather than ActivityDetail.
   */
  public async getFullActivity(activityId: string): Promise<Activity | null> {
    const detail = await this.getById(activityId);
    if (!detail) {
      return null;
    }
    const { streamsAvailable, ...activity } = detail;
    return activity;
  }

  public async upsert(activity: Activity, streamsDeflated: string | null): Promise<void> {
    await pool.query(
      `INSERT INTO activities (
        id, name, type, start_time, end_time, start_timestamp, end_timestamp,
        has_power_meter, trainer, commute, manual, is_swim_pool, auto_detected_type,
        settings_lack, device, notes, flags, lat_lng_center, hash,
        athlete_snapshot, stats, src_stats, laps, extras, streams_deflated
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        start_timestamp = EXCLUDED.start_timestamp,
        end_timestamp = EXCLUDED.end_timestamp,
        has_power_meter = EXCLUDED.has_power_meter,
        trainer = EXCLUDED.trainer,
        commute = EXCLUDED.commute,
        manual = EXCLUDED.manual,
        is_swim_pool = EXCLUDED.is_swim_pool,
        auto_detected_type = EXCLUDED.auto_detected_type,
        settings_lack = EXCLUDED.settings_lack,
        device = EXCLUDED.device,
        notes = EXCLUDED.notes,
        flags = EXCLUDED.flags,
        lat_lng_center = EXCLUDED.lat_lng_center,
        hash = EXCLUDED.hash,
        athlete_snapshot = EXCLUDED.athlete_snapshot,
        stats = EXCLUDED.stats,
        src_stats = EXCLUDED.src_stats,
        laps = EXCLUDED.laps,
        extras = EXCLUDED.extras,
        streams_deflated = EXCLUDED.streams_deflated,
        last_edit_time = now()`,
      [
        activity.id,
        activity.name,
        activity.type,
        new Date(activity.startTime),
        new Date(activity.endTime),
        activity.startTimestamp,
        activity.endTimestamp,
        !!activity.hasPowerMeter,
        !!activity.trainer,
        !!activity.commute,
        !!activity.manual,
        activity.isSwimPool ?? null,
        !!activity.autoDetectedType,
        activity.settingsLack ?? null,
        activity.device ?? null,
        activity.notes ?? null,
        activity.flags ?? null,
        activity.latLngCenter ?? null,
        activity.hash,
        JSON.stringify(activity.athleteSnapshot),
        JSON.stringify(activity.stats),
        JSON.stringify(activity.srcStats ?? null),
        JSON.stringify(activity.laps ?? null),
        JSON.stringify(activity.extras ?? null),
        streamsDeflated,
      ]
    );
  }
}
