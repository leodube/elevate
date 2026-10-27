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
import { Activity as SportsLibActivity } from "@thomaschampagne/sports-lib/lib/activities/activity";
import { Creator } from "@thomaschampagne/sports-lib/lib/creators/creator";
import { ActivityTypes } from "@thomaschampagne/sports-lib/lib/activities/activity.types";
import { ActivityParsingOptions } from "@thomaschampagne/sports-lib/lib/activities/activity-parsing-options";
import { ActivityUtilities } from "@thomaschampagne/sports-lib/lib/events/utilities/activity.utilities";
import { Stream as SportsLibStream } from "@thomaschampagne/sports-lib/lib/streams/stream";
import { DataTime } from "@thomaschampagne/sports-lib/lib/data/data.time";
import { DataDistance as SportsLibDataDistance } from "@thomaschampagne/sports-lib/lib/data/data.distance";
import { DataGNSSDistance } from "@thomaschampagne/sports-lib/lib/data/data.gnss-distance";
import { DataSpeed } from "@thomaschampagne/sports-lib/lib/data/data.speed";
import { DataAltitude } from "@thomaschampagne/sports-lib/lib/data/data.altitude";
import { DataHeartRate } from "@thomaschampagne/sports-lib/lib/data/data.heart-rate";
import { DataLatitudeDegrees } from "@thomaschampagne/sports-lib/lib/data/data.latitude-degrees";
import { DataLongitudeDegrees } from "@thomaschampagne/sports-lib/lib/data/data.longitude-degrees";

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
  public async backfill(oldest?: Date, newest?: Date, resyncExisting = false): Promise<SyncResult> {
    const settings = await this.settingsRepo.get();
    if (!settings?.apiKey) {
      throw new Error("intervals.icu is not configured - missing API key");
    }

    return this.runSync(settings.apiKey, oldest, newest, resyncExisting);
  }

  @LogMethod()
  private async runSync(
    apiKey: string,
    oldest: Date | undefined,
    newest: Date | undefined,
    resyncExisting = false
  ): Promise<SyncResult> {
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
          // resyncExisting (webapp backfill dialog's "Re-sync existing
          // activities" checkbox) - when true, don't skip; re-fetch and
          // recompute this activity just like a new one. Dated athlete
          // settings still apply either way, via the same
          // athleteSnapshotResolver.resolve() call below keyed off this
          // activity's own start date.
          const alreadySynced = await this.activitiesRepo.exists(bare.id);
          if (alreadySynced && !resyncExisting) {
            this.progress.skippedCount++;
            continue;
          }

          const [detail, streamEntries] = await Promise.all([
            client.getActivity(bare.id),
            client.getStreams(bare.id).catch(() => [] as IntervalsStreamEntry[])
          ]);

          const streams = this.mapStreams(streamEntries, detail);
          const activity = this.mapToActivity(detail);

          const startTimestamp = activity.startTimestamp;
          const athleteSnapshot: AthleteSnapshot = athleteSnapshotResolver.resolve(new Date(startTimestamp * 1000));
          const userSettings: UserSettings.BaseUserSettings = UserSettings.getDefaultsByBuildTarget
            ? UserSettings.getDefaultsByBuildTarget(BuildTarget.WEBAPP)
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
          // Stop advancing on first failure
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

    const streams = this.mapStreams(streamEntries, detail);
    const activity = this.mapToActivity(detail);

    const athleteModel = await this.athleteRepo.getAthleteModel();
    const athleteSnapshotResolver = new AthleteSnapshotResolver(athleteModel);
    const athleteSnapshot: AthleteSnapshot = athleteSnapshotResolver.resolve(new Date(activity.startTime));
    const userSettings: UserSettings.BaseUserSettings = UserSettings.getDefaultsByBuildTarget(BuildTarget.WEBAPP);

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
        ...(elapsedTimeSec > 0 && {
          moveRatio: movingTimeSec / elapsedTimeSec,
          pauseTime: elapsedTimeSec - movingTimeSec
        }),
        ...(source.distance != null &&
          movingTimeSec > 0 && {
            speed: { avg: (source.distance / movingTimeSec) * Constant.MPS_KPH_FACTOR }
          }),
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
   * Elevate's Streams model.
   */
  @LogMethod()
  private mapStreams(entries: IntervalsStreamEntry[], detail: IntervalsActivity): Streams {
    const streams = new Streams();
    for (const entry of entries) {
      if (entry.type === "latlng") {
        (streams as any).latlng = this.pairLatLng(entry.data as (number | null)[], entry.data2);
        continue;
      }
      (streams as any)[entry.type] = entry.data;
    }
    this.applySportsLibProcessing(streams, entries, detail);
    return streams;
  }

  /**
   * Runs distance/speed through the @thomaschampagne/sports-lib processing pipeline
   */
  private applySportsLibProcessing(streams: Streams, entries: IntervalsStreamEntry[], detail: IntervalsActivity): void {
    if (!streams.distance?.length || !streams.time?.length) {
      return;
    }

    try {
      const byType: Record<string, IntervalsStreamEntry> = {};
      for (const entry of entries) {
        byType[entry.type] = entry;
      }

      const originalTime = streams.time;
      const elapsedSeconds = originalTime[originalTime.length - 1];
      if (elapsedSeconds == null || elapsedSeconds < 0) {
        return;
      }

      const toDense = (data: (number | null)[] | undefined): (number | null)[] | undefined => {
        if (!data) {
          return undefined;
        }
        const dense: (number | null)[] = new Array(elapsedSeconds + 1).fill(null);
        for (let i = 0; i < data.length; i++) {
          const t = originalTime[i];
          if (t != null && t >= 0 && t <= elapsedSeconds) {
            dense[t] = data[i];
          }
        }
        return dense;
      };
      const fromDense = (dense: (number | null)[] | undefined): (number | null)[] | undefined => {
        if (!dense) {
          return undefined;
        }
        return originalTime.map(t => (t != null && t >= 0 && t <= elapsedSeconds ? dense[t] : null));
      };

      const startDate = new Date(detail.start_date);
      const endDate = new Date(startDate.getTime() + elapsedSeconds * 1000);
      const activityType = (ActivityTypes as any)[detail.type] ?? ActivityTypes.Other;

      const parsingOptions = new ActivityParsingOptions({
        streams: {
          smooth: { altitudeSmooth: true, grade: true, gradeSmooth: true },
          fixAbnormal: { speed: true }
        },
        maxActivityDurationDays: 30
      });

      const sportsLibActivity = new SportsLibActivity(
        startDate,
        endDate,
        activityType,
        new Creator("intervals.icu"),
        parsingOptions
      );

      const denseTime = Array.from({ length: elapsedSeconds + 1 }, (_, i) => i);
      sportsLibActivity.addStream(new SportsLibStream(DataTime.type, denseTime));

      const denseDistance = toDense(byType.distance?.data as (number | null)[] | undefined);
      if (denseDistance) {
        sportsLibActivity.addStream(new SportsLibStream(SportsLibDataDistance.type, denseDistance));
      }
      const denseSpeed = toDense(byType.velocity_smooth?.data as (number | null)[] | undefined);
      if (denseSpeed) {
        sportsLibActivity.addStream(new SportsLibStream(DataSpeed.type, denseSpeed));
      }
      const denseAltitude = toDense(byType.altitude?.data as (number | null)[] | undefined);
      if (denseAltitude) {
        sportsLibActivity.addStream(new SportsLibStream(DataAltitude.type, denseAltitude));
      }
      const denseHeartrate = toDense(byType.heartrate?.data as (number | null)[] | undefined);
      if (denseHeartrate) {
        sportsLibActivity.addStream(new SportsLibStream(DataHeartRate.type, denseHeartrate));
      }
      // intervals.icu splits latlng as data=lat, data2=lng, not paired [lat,lng]
      if (byType.latlng) {
        const denseLat = toDense(byType.latlng.data as (number | null)[] | undefined);
        const denseLng = toDense(byType.latlng.data2 as (number | null)[] | undefined);
        if (denseLat) {
          sportsLibActivity.addStream(new SportsLibStream(DataLatitudeDegrees.type, denseLat));
        }
        if (denseLng) {
          sportsLibActivity.addStream(new SportsLibStream(DataLongitudeDegrees.type, denseLng));
        }
      }

      ActivityUtilities.generateMissingStreamsAndStatsForActivity(sportsLibActivity);

      if (sportsLibActivity.hasStreamData(DataGNSSDistance.type)) {
        const sparseDistance = fromDense(sportsLibActivity.getStreamData(DataGNSSDistance.type) as (number | null)[]);
        if (sparseDistance) {
          streams.distance = IntervalsConnector.fillIsolatedNulls(sparseDistance, originalTime);
        }
      }
      if (sportsLibActivity.hasStreamData(DataSpeed.type)) {
        const sparseSpeed = fromDense(sportsLibActivity.getStreamData(DataSpeed.type) as (number | null)[]);
        if (sparseSpeed) {
          streams.velocity_smooth = sparseSpeed as number[];
        }
      }
    } catch (err) {
      // Leave streams as intervals.icu returned them
    }
  }

  /**
   * sports-lib's GNSS-distance generation (createDerivedStreams, in generateMissingStreamsForActivity)
   * skips any index where position is null rather than filling it - `if (!position) return
   * prevPosition` - and never writes that index, leaving it at Stream's default null. The
   * native distance field doesn't have this failure mode (it apparently fuses other sensors
   * and never drops a sample), so this problem is specific to preferring DataGNSSDistance.
   *
   * Confirmed against real activity data: a single momentary GPS dropout (lat/lng both null
   * for one sample, everything else around it fine) produced exactly one stray null in the
   * re-sparsified distance stream. A single null x-coordinate feeding a spline-shaped chart
   * trace produced a dramatic full-width visual artifact - regressed a previously-clean
   * Garmin activity's distance-scale chart after switching from native to GNSS distance.
   *
   * This fills only isolated interior null runs via linear (time-weighted) interpolation
   * between the nearest real neighbors - deliberately not the general noise/duplicate cleanup
   * from the previous approach, just closing the specific gap sports-lib's own generation
   * leaves behind. Leading/trailing null runs (no anchor on one side) are edge-filled from the
   * nearest real value instead, same as before.
   */
  private static fillIsolatedNulls(values: (number | null)[], time: number[]): number[] {
    const filled = values.slice();

    const firstValid = filled.findIndex(value => value != null);
    if (firstValid === -1) {
      return filled as number[];
    }
    for (let i = 0; i < firstValid; i++) {
      filled[i] = filled[firstValid];
    }
    const lastValid = filled.length - 1 - [...filled].reverse().findIndex(value => value != null);
    for (let i = lastValid + 1; i < filled.length; i++) {
      filled[i] = filled[lastValid];
    }

    let anchor = firstValid;
    let i = anchor + 1;
    while (i <= lastValid) {
      if (filled[i] != null) {
        anchor = i;
        i++;
        continue;
      }
      let nextValid = i + 1;
      while (filled[nextValid] == null) {
        nextValid++;
      }
      const startValue = filled[anchor] as number;
      const endValue = filled[nextValid] as number;
      const totalSpan = time[nextValid] - time[anchor];
      for (let j = anchor + 1; j < nextValid; j++) {
        const frac = totalSpan > 0 ? (time[j] - time[anchor]) / totalSpan : 0;
        filled[j] = startValue + frac * (endValue - startValue);
      }
      anchor = nextValid;
      i = nextValid + 1;
    }

    return filled as number[];
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
