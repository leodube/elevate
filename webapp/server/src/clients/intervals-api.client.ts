import { env } from "../config/env";

/**
 * Thin HTTP client for the intervals.icu REST API.
 *
 * Auth: confirmed against the official cookbook (forum.intervals.icu) as
 * plain HTTP Basic auth, with the literal string "API_KEY" as the username
 * and the actual per-athlete API key as the password. This is NOT the
 * "ApiKey <key>" custom header scheme some third-party summaries show -
 * that appears to be inaccurate; Basic auth is what intervals.icu's own
 * docs demonstrate.
 *
 * Field names below are taken from the real OpenAPI spec (via
 * ActivityFilter.field_id enum, which lists actual API field names) and
 * the cookbook's example response - not guessed. A few remain unconfirmed
 * because the full Activity schema wasn't reachable during research; those
 * are marked explicitly. Verify against a real response during first
 * integration testing and adjust IntervalsActivity below if any are wrong -
 * unknown fields simply won't populate, they won't throw.
 */

export interface IntervalsActivity {
  id: string; // confirmed format e.g. "i55751783"
  name: string;
  type: string; // e.g. "Ride", "Run", "Swim" - intervals.icu's own sport enum, mapped to ElevateSport separately
  start_date_local: string; // confirmed field name; timezone-naive local ISO datetime (no offset) - see mapping notes
  moving_time: number; // seconds - confirmed via ActivityFilter field_id
  elapsed_time: number; // seconds - confirmed via ActivityFilter field_id
  distance: number; // meters - confirmed
  average_heartrate?: number; // confirmed
  max_heartrate?: number; // confirmed
  average_speed?: number; // m/s - confirmed
  max_speed?: number; // confirmed
  average_cadence?: number; // confirmed
  average_power?: number; // confirmed - NOTE: named differently from Strava's "average_watts"
  icu_weighted_avg_watts?: number; // confirmed - normalized/weighted power
  average_temp?: number; // confirmed
  calories?: number; // confirmed
  device_name?: string; // confirmed
  trimp?: number; // confirmed
  file_type?: string; // confirmed, e.g. "fit"
  // UNCONFIRMED - elevation gain. ActivityFilter lists a "climbing" filter
  // field; the real JSON key may be "climbing" or "icu_climbing". Verify
  // against a real response.
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

  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${env.intervals.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      headers: { Authorization: this.authHeader() },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`intervals.icu API error ${response.status} on ${path}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Lists activities for the authenticated athlete ("0" resolves to "self"
   * per the cookbook) within an optional date range. Used for both
   * incremental sync (oldest = last watermark) and backfill (oldest = far
   * in the past / omitted).
   */
  public async listActivities(oldest?: Date, newest?: Date): Promise<IntervalsActivity[]> {
    const params = new URLSearchParams();
    if (oldest) {
      params.set("oldest", oldest.toISOString().slice(0, 10));
    }
    if (newest) {
      params.set("newest", newest.toISOString().slice(0, 10));
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.fetchJson<IntervalsActivity[]>(`/athlete/0/activities${query}`);
  }

  public async getActivity(activityId: string): Promise<IntervalsActivity> {
    return this.fetchJson<IntervalsActivity>(`/activity/${activityId}?intervals=true`);
  }

  /**
   * Fetches raw streams for an activity. Per the OpenAPI spec description,
   * intervals.icu has a quirk: without an explicit "watts" type requested,
   * the analyzed/fixed power stream may come back renamed to "raw_watts".
   * We explicitly request "watts" below to get the analyzed stream,
   * matching what Elevate's compute pipeline expects.
   */
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
      "temp",
    ].join(",");
    return this.fetchJson<IntervalsStreamEntry[]>(
      `/activity/${activityId}/streams.json?types=${types}`
    );
  }
}
