import { BuildTarget } from "@elevate/shared/enums/build-target.enum";
import { ElevateSport } from "@elevate/shared/enums/elevate-sport.enum";
import { Streams } from "@elevate/shared/models/activity-data/streams.model";
import { AthleteSnapshot } from "@elevate/shared/models/athlete/athlete-snapshot.model";
import { Activity } from "@elevate/shared/models/sync/activity.model";
import { SyncProgress } from "@elevate/shared/models/sync/sync-progress.model";
import { UserSettings } from "@elevate/shared/models/user-settings/user-settings.namespace";
import { AthleteSnapshotResolver } from "@elevate/shared/resolvers/athlete-snapshot.resolver";
import {
  IntervalsActivity,
  IntervalsApiClient,
  IntervalsStreamEntry,
  IcuInterval
} from "../clients/intervals-api.client";
import { Movement } from "@elevate/shared/tools/movement";
import { Constant } from "@elevate/shared/constants/constant";
import { Lap } from "@elevate/shared/models/sync/activity.model";
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
  private progress: SyncProgress = IntervalsConnector.idleProgress();

  constructor(
    private readonly settingsRepo: IntervalsSettingsRepository,
    private readonly activitiesRepo: ActivitiesRepository,
    private readonly athleteRepo: AthleteRepository
  ) {}

  public get isSyncing(): boolean {
    return this.progress.isSyncing;
  }

  /**
   * Snapshot for the /api/sync/status poll. Returns a copy to prevent mutation
   */
  public getProgress(): SyncProgress {
    return { ...this.progress, errors: [...this.progress.errors] };
  }

  private static idleProgress(): SyncProgress {
    return {
      isSyncing: false,
      totalFound: null,
      processedCount: 0,
      skippedCount: 0,
      currentActivity: null,
      errors: [],
      startedAt: null,
      completedAt: null
    };
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
    if (this.progress.isSyncing) {
      throw new Error("Sync already in progress");
    }
    this.progress = {
      isSyncing: true,
      totalFound: null,
      processedCount: 0,
      skippedCount: 0,
      currentActivity: null,
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: null
    };

    try {
      const athleteModel = await this.athleteRepo.getAthleteModel();
      const athleteSnapshotResolver = new AthleteSnapshotResolver(athleteModel);

      const client = new IntervalsApiClient(apiKey);
      const bareActivities = await client.listActivities(oldest, newest);

      bareActivities.sort((a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime());
      this.progress.totalFound = bareActivities.length;

      let latestProcessedTimestamp: number | null = null;

      for (const bare of bareActivities) {
        this.progress.currentActivity = { id: bare.id, name: bare.name, startTime: bare.start_date_local };

        try {
          const alreadySynced = await this.activitiesRepo.exists(bare.id);
          if (alreadySynced) {
            this.progress.skippedCount++;
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
            true, // deflateStreams
            true, // returnPeaks
            true // returnZones
          );

          await this.activitiesRepo.upsert(computedActivity, deflatedStreams);

          this.progress.processedCount++;
          latestProcessedTimestamp = startTimestamp;
        } catch (err) {
          this.progress.errors.push({ activityId: bare.id, message: (err as Error).message });
          // Stop advancing on first failure, on purpose - see prior discussion.
          break;
        }
      }

      if (latestProcessedTimestamp !== null) {
        await this.settingsRepo.updateWatermark(latestProcessedTimestamp);
      }

      return {
        activitiesProcessed: this.progress.processedCount,
        activitiesSkipped: this.progress.skippedCount,
        errors: [...this.progress.errors]
      };
    } finally {
      this.progress.isSyncing = false;
      this.progress.currentActivity = null;
      this.progress.completedAt = new Date().toISOString();
    }
  }

  /**
   * Re-fetches an activity and recomputes it against currently athlete settings
   */
  @LogMethod()
  public async resyncActivity(activityId: string): Promise<void> {
    const settings = await this.settingsRepo.get();
    if (!settings?.apiKey) {
      throw new Error("intervals.icu is not configured - missing API key");
    }

    const client = new IntervalsApiClient(settings.apiKey);
    const [detail, streamEntries] = await Promise.all([
      client.getActivity(activityId),
      client.getStreams(activityId).catch(() => [] as IntervalsStreamEntry[])
    ]);

    const streams = this.mapStreams(streamEntries);
    const activity = this.mapToActivity(detail);

    const athleteModel = await this.athleteRepo.getAthleteModel();
    const athleteSnapshotResolver = new AthleteSnapshotResolver(athleteModel);
    const athleteSnapshot: AthleteSnapshot = athleteSnapshotResolver.resolve(new Date(activity.startTime));
    const userSettings: UserSettings.BaseUserSettings = UserSettings.getDefaultsByBuildTarget(BuildTarget.DESKTOP);

    const { computedActivity, deflatedStreams } = await ActivityComputeProcessor.compute(
      activity,
      athleteSnapshot,
      userSettings,
      streams,
      true, // deflateStreams
      true, // returnPeaks
      true // returnZones
    );

    await this.activitiesRepo.upsert(computedActivity, deflatedStreams);
  }

  /**
   * Maps an intervals.icu activity onto Elevate's Activity model.
   */
  @LogMethod()
  private mapToActivity(source: IntervalsActivity): Partial<Activity> {
    const startTime = new Date(source.start_date);
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
      hasPowerMeter: source.device_watts ?? false,
      trainer: source.trainer ?? false,
      commute: source.commute ?? false,
      manual: source.source === "MANUAL",
      autoDetectedType: false,
      device: source.device_name ?? null,
      notes: source.description ?? null,
      laps: this.mapToLaps(source.icu_intervals, (source.type as ElevateSport) ?? ElevateSport.Other),
      srcStats: {
        ...(source.distance != null && { distance: source.distance }),
        ...(movingTimeSec != null && { movingTime: movingTimeSec }),
        ...(elapsedTimeSec != null && { elapsedTime: elapsedTimeSec }),
        ...(source.calories != null && { calories: source.calories })
      } as any
    };
  }

  /**
   * Maps intervals.icu's icu_intervals onto Elevate's Lap[] model.
   */
  private mapToLaps(icuIntervals: IcuInterval[] | undefined, sport: ElevateSport): Lap[] | null {
    if (!icuIntervals || icuIntervals.length === 0) {
      return null;
    }

    const isPaced = Activity.isPaced(sport);

    return icuIntervals.map(interval => {
      const avgSpeedKph = interval.average_speed != null ? interval.average_speed * Constant.MPS_KPH_FACTOR : null;
      const maxSpeedKph = interval.max_speed != null ? interval.max_speed * Constant.MPS_KPH_FACTOR : null;

      const lap: Lap = {
        id: interval.id,
        active: interval.type === "WORK",
        indexes: [interval.start_index, interval.end_index],
        distance: interval.distance ?? undefined,
        elevationGain: interval.total_elevation_gain ?? undefined,
        elapsedTime: interval.elapsed_time ?? undefined,
        movingTime: interval.moving_time ?? undefined,
        avgCadence: interval.average_cadence ?? undefined,
        avgHr: interval.average_heartrate ?? undefined,
        maxHr: interval.max_heartrate ?? undefined,
        avgWatts: interval.average_watts ?? undefined
      };

      if (isPaced) {
        lap.avgPace = avgSpeedKph != null ? (Movement.speedToPace(avgSpeedKph) ?? undefined) : undefined;
        lap.maxPace = maxSpeedKph != null ? (Movement.speedToPace(maxSpeedKph) ?? undefined) : undefined;
      } else {
        lap.avgSpeed = avgSpeedKph ?? undefined;
        lap.maxSpeed = maxSpeedKph ?? undefined;
      }

      return lap;
    });
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
      if (entry.type === "latlng") {
        (streams as any).latlng = this.pairLatLng(entry.data as (number | null)[], entry.data2);
        continue;
      }
      (streams as any)[entry.type] = entry.data;
    }
    return streams;
  }

  /**
   * Combines intervals.icu's separate data (lat) and data2 (lng) arrays
   * into [lat, lng] pairs at each index. A null in either component at a
   * given index produces a null pair at that index rather than a partial tuple.
   */
  private pairLatLng(lat: (number | null)[], lng: (number | null)[] | undefined): (number[] | null)[] {
    if (!lng) {
      return [];
    }
    return lat.map((latValue, i) => {
      const lngValue = lng[i];
      return latValue != null && lngValue != null ? [latValue, lngValue] : null;
    });
  }
}
