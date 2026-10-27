import { pool } from "../db/pool";

export interface UserOptions {
  systemUnit: string;
  temperatureUnit: string;
  disableMissingStressScoresWarning: boolean;
  disableActivitiesNeedRecalculationWarning: boolean;
}

interface OptionSpec {
  column: string;
  isValid: (value: unknown) => boolean;
}

const OPTION_SPECS: Record<string, OptionSpec> = {
  systemUnit: {
    column: "system_unit",
    isValid: v => v === "metric" || v === "imperial"
  },
  temperatureUnit: {
    column: "temperature_unit",
    isValid: v => v === "C" || v === "F"
  },
  disableMissingStressScoresWarning: {
    column: "disable_missing_stress_scores_warning",
    isValid: v => typeof v === "boolean"
  },
  disableActivitiesNeedRecalculationWarning: {
    column: "disable_activities_need_recalculation_warning",
    isValid: v => typeof v === "boolean"
  }
};

export class UserOptionsRepository {
  public async get(): Promise<UserOptions> {
    const result = await pool.query(
      `SELECT system_unit, temperature_unit, disable_missing_stress_scores_warning,
              disable_activities_need_recalculation_warning
       FROM user_settings WHERE id = 1`
    );
    return toUserOptions(result.rows[0]);
  }

  public async updateOption(optionKey: string, optionValue: unknown): Promise<UserOptions> {
    const spec = OPTION_SPECS[optionKey];
    if (!spec) {
      throw new Error(`Unknown option: ${optionKey}`);
    }

    const result = await pool.query(
      `UPDATE user_settings SET ${spec.column} = $1, updated_at = now() WHERE id = 1
       RETURNING system_unit, temperature_unit, disable_missing_stress_scores_warning,
                 disable_activities_need_recalculation_warning`,
      [optionValue]
    );
    return toUserOptions(result.rows[0]);
  }
}

export function isKnownOption(optionKey: string): boolean {
  return !!OPTION_SPECS[optionKey];
}

export function isValidOptionValue(optionKey: string, value: unknown): boolean {
  return !!OPTION_SPECS[optionKey]?.isValid(value);
}

function toUserOptions(row: any): UserOptions {
  return {
    systemUnit: row.system_unit,
    temperatureUnit: row.temperature_unit,
    disableMissingStressScoresWarning: row.disable_missing_stress_scores_warning,
    disableActivitiesNeedRecalculationWarning: row.disable_activities_need_recalculation_warning
  };
}
