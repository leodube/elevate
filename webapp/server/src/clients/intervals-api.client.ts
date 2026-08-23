import { env } from "../config/env";
import { LogMethod } from "../tools/decorators";

/**
 * Thin HTTP client for the intervals.icu REST API.
 *
 * Open API spec:
 * intervals.icu/api-docs.html#overview
 */

export interface IntervalsActivity {
  id: string;
  name: string;
  type: string; // e.g. "Ride", "Run", "Swim"
  start_date_local: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  max_speed?: number;
  average_cadence?: number;
  average_power?: number;
  icu_weighted_avg_watts?: number;
  average_temp?: number;
  calories?: number;
  device_name?: string;
  trimp?: number;
  file_type?: string; // e.g. "fit"
  // UNCONFIRMED
  icu_climbing?: number;
  climbing?: number;
}

export interface IntervalsStreamEntry {
  type: string;
  data: number[] | number[][];
}

export class IntervalsApiClient {
  constructor(private readonly apiKey: string) {}

  private authHeader(): string {
    const credentials = Buffer.from(`API_KEY:${this.apiKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  @LogMethod()
  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${env.intervals.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      headers: { Authorization: this.authHeader() }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`intervals.icu API error ${response.status} on ${path}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Lists activities for the authenticated athlete ("0" resolves to "self")
   *
   * OpenAPI Spec:
   * https://intervals.icu/api-docs.html#get-/api/v1/athlete/-id-/activities
   */
  @LogMethod()
  public async listActivities(oldest: Date = new Date("2024-01-01"), newest?: Date): Promise<IntervalsActivity[]> {
    const params = new URLSearchParams();
    params.set("oldest", oldest.toISOString().slice(0, 10));

    if (newest) {
      params.set("newest", newest.toISOString().slice(0, 10));
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return await this.fetchJson<IntervalsActivity[]>(`/athlete/0/activities${query}`);
  }

  /**
   * Gets an activity by id
   *
   * OpenAPI Spec:
   * https://intervals.icu/api-docs.html#get-/api/v1/activity/-id-
   */
  @LogMethod()
  public async getActivity(activityId: string): Promise<IntervalsActivity> {
    return this.fetchJson<IntervalsActivity>(`/activity/${activityId}?intervals=true`);
  }

  /**
   * Fetches raw streams for an activity
   *
   * OpenAPI Spec:
   * https://intervals.icu/api-docs.html#get-/api/v1/activity/-id-/streams-ext-
   */
  @LogMethod()
  public async getStreams(activityId: string): Promise<IntervalsStreamEntry[]> {
    const types = [
      "time",
      "distance",
      "watts",
      "heartrate",
      "cadence",
      "altitude",
      "latlng",
      "velocity_smooth",
      "grade_smooth",
      "temp"
    ].join(",");
    return this.fetchJson<IntervalsStreamEntry[]>(`/activity/${activityId}/streams.json?types=${types}`);
  }
}
