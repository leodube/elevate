import { pool } from "../db/pool";

export interface UserZones {
  speed: number[];
  pace: number[];
  heartRate: number[];
  power: number[];
  runningPower: number[];
  cyclingCadence: number[];
  runningCadence: number[];
  grade: number[];
  elevation: number[];
  ascent: number[];
}

// Maps ZoneType enum values (@elevate/shared) to their column
const ZONE_TYPE_COLUMNS: Record<string, string> = {
  speed: "speed",
  pace: "pace",
  heartRate: "heart_rate",
  power: "power",
  runningPower: "running_power",
  cyclingCadence: "cycling_cadence",
  runningCadence: "running_cadence",
  grade: "grade",
  elevation: "elevation",
  ascent: "ascent"
};

export class UserZonesRepository {
  public async get(): Promise<UserZones> {
    const result = await pool.query(
      `SELECT speed, pace, heart_rate, power, running_power, cycling_cadence, running_cadence,
              grade, elevation, ascent
       FROM user_zones WHERE id = 1`
    );
    return toUserZones(result.rows[0]);
  }

  public async updateZoneType(zoneType: string, values: number[]): Promise<UserZones> {
    const column = ZONE_TYPE_COLUMNS[zoneType];
    if (!column) {
      throw new Error(`Unknown zone type: ${zoneType}`);
    }

    const result = await pool.query(
      `UPDATE user_zones SET ${column} = $1, updated_at = now() WHERE id = 1
       RETURNING speed, pace, heart_rate, power, running_power, cycling_cadence, running_cadence,
                 grade, elevation, ascent`,
      [values]
    );
    return toUserZones(result.rows[0]);
  }
}

export function isKnownZoneType(zoneType: string): boolean {
  return !!ZONE_TYPE_COLUMNS[zoneType];
}

function toUserZones(row: any): UserZones {
  return {
    speed: row.speed,
    pace: row.pace,
    heartRate: row.heart_rate,
    power: row.power,
    runningPower: row.running_power,
    cyclingCadence: row.cycling_cadence,
    runningCadence: row.running_cadence,
    grade: row.grade,
    elevation: row.elevation,
    ascent: row.ascent
  };
}
