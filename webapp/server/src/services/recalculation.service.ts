import { RecalculateProgress } from "@elevate/shared/models/sync/recalculate-progress.model";
import { AthleteSnapshotResolver } from "@elevate/shared/resolvers/athlete-snapshot.resolver";
import { BuildTarget } from "@elevate/shared/enums/build-target.enum";
import { UserSettings } from "@elevate/shared/models/user-settings/user-settings.namespace";
import { Streams } from "@elevate/shared/models/activity-data/streams.model";
import { ActivityComputeProcessor } from "../processors/activity-compute/activity-compute.processor";
import { ActivitiesRepository } from "../repositories/activities.repository";
import { AthleteRepository } from "../repositories/athlete.repository";

/**
 * Recalculates already-synced activities against current athlete
 * settings. Deliberately does NOT call intervals.icu - everything
 * ActivityComputeProcessor.compute() needs (the mapped Activity fields,
 * the stored streams) already lives in Postgres from the original sync.
 * Only the athlete snapshot changes (re-resolved from current dated
 * settings) and the userSettings, then compute reruns and the row is
 * updated in place. This is simpler and cheaper than desktop's live IPC
 * recompute or the extension's delete-and-resync approach - see the
 * earlier planning discussion for why neither of those map onto this
 * architecture.
 */
export class RecalculationService {
  private progress: RecalculateProgress = RecalculationService.idleProgress();

  constructor(
    private readonly activitiesRepo: ActivitiesRepository,
    private readonly athleteRepo: AthleteRepository
  ) {}

  public get isRecalculating(): boolean {
    return this.progress.isRecalculating;
  }

  public getProgress(): RecalculateProgress {
    return { ...this.progress, errors: [...this.progress.errors] };
  }

  private static idleProgress(): RecalculateProgress {
    return {
      isRecalculating: false,
      totalToProcess: 0,
      processedCount: 0,
      currentActivity: null,
      errors: [],
      startedAt: null,
      completedAt: null
    };
  }

  public async recalculate(activityIds: string[]): Promise<void> {
    if (this.progress.isRecalculating) {
      throw new Error("Recalculation already in progress");
    }

    this.progress = {
      isRecalculating: true,
      totalToProcess: activityIds.length,
      processedCount: 0,
      currentActivity: null,
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: null
    };

    try {
      const athleteModel = await this.athleteRepo.getAthleteModel();
      const athleteSnapshotResolver = new AthleteSnapshotResolver(athleteModel);
      const userSettings = UserSettings.getDefaultsByBuildTarget(BuildTarget.DESKTOP);

      for (const activityId of activityIds) {
        try {
          const activity = await this.activitiesRepo.getFullActivity(activityId);
          if (!activity) {
            this.progress.errors.push({ activityId, message: "Activity not found" });
            continue;
          }

          this.progress.currentActivity = {
            id: activity.id as string,
            name: activity.name,
            startTime: activity.startTime
          };

          const deflatedStreams = await this.activitiesRepo.getStreamsDeflated(activityId);
          const streams = deflatedStreams ? Streams.inflate(deflatedStreams) : new Streams();

          const athleteSnapshot = athleteSnapshotResolver.resolve(new Date(activity.startTime));

          const { computedActivity, deflatedStreams: newDeflatedStreams } = await ActivityComputeProcessor.compute(
            activity,
            athleteSnapshot,
            userSettings,
            streams,
            true
          );

          await this.activitiesRepo.upsert(computedActivity, newDeflatedStreams ?? deflatedStreams);

          this.progress.processedCount++;
        } catch (err) {
          this.progress.errors.push({ activityId, message: (err as Error).message });
          // Continue to the next activity rather than stopping the whole
          // batch, unlike sync's fail-fast-and-stop behavior - a single
          // bad activity here shouldn't block recalculating the rest.
        }
      }
    } finally {
      this.progress.isRecalculating = false;
      this.progress.currentActivity = null;
      this.progress.completedAt = new Date().toISOString();
    }
  }
}
