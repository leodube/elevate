import { ElevateSport } from "@elevate/shared/enums/elevate-sport.enum";
import { AthleteSnapshot } from "@elevate/shared/models/athlete/athlete-snapshot.model";
import { Activity } from "@elevate/shared/models/sync/activity.model";
import { Streams } from "@elevate/shared/models/activity-data/streams.model";
import { UserSettings } from "@elevate/shared/models/user-settings/user-settings.namespace";
import { AthleteSnapshotResolver } from "@elevate/shared/resolvers/athlete-snapshot.resolver";
import { BuildTarget } from "@elevate/shared/enums/build-target.enum";
import { IntervalsActivity, IntervalsApiClient, IntervalsStreamEntry } from "../clients/intervals-api.client";
import { ActivityComputeProcessor } from "../processors/activity-compute/activity-compute.processor";
import { ActivitiesRepository } from "../repositories/activities.repository";
import { AthleteRepository } from "../repositories/athlete.repository";
import { IntervalsSettingsRepository } from "../repositories/intervals-settings.repository";
import { LogMethod } from "../tools/decorators";

export interface SyncResult {
  activitiesProcessed: number;
  activitiesSkipped: number;
  errors: { activityId: string; message: string }[];
}

/**
 * Athlete context is loaded fresh at the start of each sync (see runSync)
 * from athlete_profile + athlete_dated_settings, via AthleteRepository.
 * Until real values are entered through the settings UI, the schema seeds
 * a single "forever" entry equivalent to AthleteSettings.DEFAULT_MODEL, so
 * compute always has something to resolve against - ActivityComputer.
 * hasAthleteSettingsLacks() will correctly flag activity.settingsLack
 * wherever a stat couldn't be fully computed without real FTP/HR max,
 * rather than silently producing wrong numbers.
 */

export class IntervalsConnector {
  private isSyncingFlag = false;

  constructor(
    private readonly settingsRepo: IntervalsSettingsRepository,
    private readonly activitiesRepo: ActivitiesRepository,
    private readonly athleteRepo: AthleteRepository
  ) {}

  public get isSyncing(): boolean {
    return this.isSyncingFlag;
  }

  /**
   * Incremental sync: pulls activities newer than the stored watermark.
   * This is the "on load / background timer / manual button" path.
   */
  @LogMethod()
  public async syncNew(): Promise<SyncResult> {
    const settings = await this.settingsRepo.get();
    if (!settings?.apiKey) {
      throw new Error("intervals.icu is not configured - missing API key");
    }

    const oldest = settings.lastSyncedStartTimestamp ? new Date(settings.lastSyncedStartTimestamp * 1000) : undefined;

    return this.runSync(settings.apiKey, oldest, undefined);
  }

  /**
   * Backfill: pulls full activity history (or a given range), ignoring the
   * incremental watermark. Intended for the manual "backfill" action on the
   * connectors page.
   */
  @LogMethod()
  public async backfill(oldest?: Date, newest?: Date): Promise<SyncResult> {
    const settings = await this.settingsRepo.get();
    if (!settings?.apiKey) {
      throw new Error("intervals.icu is not configured - missing API key");
    }

    return this.runSync(settings.apiKey, oldest, newest);
  }

  @LogMethod()
  private async runSync(apiKey: string, oldest: Date | undefined, newest: Date | undefined): Promise<SyncResult> {
    if (this.isSyncingFlag) {
      throw new Error("Sync already in progress");
    }
    this.isSyncingFlag = true;

    const result: SyncResult = { activitiesProcessed: 0, activitiesSkipped: 0, errors: [] };

    try {
      const athleteModel = await this.athleteRepo.getAthleteModel();
      const athleteSnapshotResolver = new AthleteSnapshotResolver(athleteModel);

      const client = new IntervalsApiClient(apiKey);
      const bareActivities = await client.listActivities(oldest, newest);

      bareActivities.sort((a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime());

      let latestProcessedTimestamp: number | null = null;

      for (const bare of bareActivities) {
        try {
          const alreadySynced = await this.activitiesRepo.exists(bare.id);
          if (alreadySynced) {
            result.activitiesSkipped++;
            continue;
          }

          const [detail, streamEntries] = await Promise.all([
            client.getActivity(bare.id),
            client.getStreams(bare.id).catch(() => [] as IntervalsStreamEntry[])
          ]);

          const streams = this.mapStreams(streamEntries);
          const activity = this.mapToActivity(detail);

          const startTimestamp = activity.startTimestamp;
          const athleteSnapshot: AthleteSnapshot = athleteSnapshotResolver.resolve(new Date(startTimestamp * 1000));
          const userSettings: UserSettings.BaseUserSettings = UserSettings.getDefaultsByBuildTarget
            ? UserSettings.getDefaultsByBuildTarget(BuildTarget.DESKTOP)
            : ({} as UserSettings.BaseUserSettings);

          const { computedActivity, deflatedStreams } = await ActivityComputeProcessor.compute(
            activity,
            athleteSnapshot,
            userSettings,
            streams,
            true
          );

          await this.activitiesRepo.upsert(computedActivity, deflatedStreams);

          result.activitiesProcessed++;
          latestProcessedTimestamp = startTimestamp;
        } catch (err) {
          result.errors.push({ activityId: bare.id, message: (err as Error).message });
          // Stop advancing the watermark past a failure
          break;
        }
      }

      if (latestProcessedTimestamp !== null) {
        await this.settingsRepo.updateWatermark(latestProcessedTimestamp);
      }

      return result;
    } finally {
      this.isSyncingFlag = false;
    }
  }

  /**
   * Maps an intervals.icu activity onto Elevate's Activity model.
   *
   * start_date_local has no timezone offset. Treating it as UTC is a
   * deliberate, documented choice to avoid depending on the server's own
   * local timezone (which would silently shift times if the container ever
   * moves). The real-world clock time may be off by the athlete's UTC
   * offset - acceptable for now, worth revisiting if intervals.icu exposes
   * a separate timezone field once we can inspect a real payload.
   */
  @LogMethod()
  private mapToActivity(source: IntervalsActivity): Partial<Activity> {
    const startTime = new Date(`${source.start_date_local}Z`);
    const movingTimeSec = source.moving_time ?? 0;
    const elapsedTimeSec = source.elapsed_time ?? movingTimeSec;
    const endTime = new Date(startTime.getTime() + elapsedTimeSec * 1000);

    return {
      id: source.id,
      name: source.name,
      type: (source.type as ElevateSport) ?? ElevateSport.Other,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      startTimestamp: Math.floor(startTime.getTime() / 1000),
      endTimestamp: Math.floor(endTime.getTime() / 1000),
      hasPowerMeter: source.average_power != null || source.icu_weighted_avg_watts != null,
      trainer: false, // UNCONFIRMED: no trainer/indoor boolean field confirmed yet - defaulting false
      commute: false, // UNCONFIRMED: not present in confirmed field list
      manual: source.file_type == null, // heuristic: no file_type implies a manually-entered activity
      autoDetectedType: false,
      device: source.device_name ?? null,
      srcStats: {
        distance: source.distance ?? null,
        movingTime: movingTimeSec,
        elapsedTime: elapsedTimeSec,
        elevationGain: source.icu_climbing ?? source.climbing ?? null,
        calories: source.calories ?? null
      } as any
    };
  }

  /**
   * Maps intervals.icu's streams.json array-of-{type,data} shape onto
   * Elevate's Streams model. Field names for common streams (time,
   * distance, heartrate, cadence, altitude, latlng, grade_smooth, temp)
   * match Strava's/Elevate's own naming directly since we explicitly
   * request those exact type names in getStreams().
   */
  @LogMethod()
  private mapStreams(entries: IntervalsStreamEntry[]): Streams {
    const streams = new Streams();
    for (const entry of entries) {
      (streams as any)[entry.type] = entry.data;
    }
    return streams;
  }
}
