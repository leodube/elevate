import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Activity } from "@elevate/shared/models/sync/activity.model";
import { ActivityDao } from "../../../dao/activity/activity.dao";
import { AthleteSnapshotResolverService } from "../../athlete-snapshot-resolver/athlete-snapshot-resolver.service";
import { LoggerService } from "../../logging/logger.service";
import { ActivityService } from "../activity.service";
import { environment } from "../../../../../environments/environment";

interface ActivitiesListResponse {
  items: Activity[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * HTTP-backed against webapp/server's /api/activities - the actual point
 * of the webapp target. Overrides fetch/findSorted/getById/count, which
 * cover everything the activities list/detail views need.
 *
 * v1 GAP, deliberately not overridden (falls through to the parent class's
 * activityDao, which is backed by the empty local WebappDataStore - i.e.
 * these will silently act as if there's no local data):
 *   - find(), findByIds(), findSince(), findByDatedSession()
 *   - insert/insertMany/update/put/removeById/removeByManyIds/clear
 *   - countByType(), countWithConnector()
 *   - createManualEntry() - manual entry doesn't map cleanly onto a
 *     server whose sole data source is intervals.icu; out of v1 scope
 *   - isAthleteSettingsConsistent()/verifyConsistencyWithAthleteSettings()/
 *     nonConsistentActivitiesWithAthleteSettings() - depend on
 *     athleteSnapshotResolver, which itself depends on WebappAthleteService
 *     (also a flagged v1 gap)
 * None of these are exercised by the activities list/detail or connectors
 * pages this target is built for; they'd need real backend endpoints
 * (bulk mutation, manual entry, athlete-settings-aware queries) to wire up
 * properly rather than a client-side workaround.
 */
@Injectable()
export class WebappActivityService extends ActivityService {
  constructor(
    @Inject(ActivityDao) public readonly activityDao: ActivityDao,
    @Inject(AthleteSnapshotResolverService) public readonly athleteSnapshotResolver: AthleteSnapshotResolverService,
    @Inject(LoggerService) protected readonly logger: LoggerService,
    @Inject(HttpClient) private readonly httpClient: HttpClient
  ) {
    super(activityDao, athleteSnapshotResolver, logger);
  }

  public fetch(): Promise<Activity[]> {
    return this.findSorted(false);
  }

  public findSorted(descending: boolean = false): Promise<Activity[]> {
    // limit=500 keeps this a single request for a personal-scale history
    // rather than adding pagination UI in v1. Revisit if/when history
    // grows past that.
    const url = `${environment.backendBaseUrl}/api/activities?limit=500`;
    return firstValueFrom(this.httpClient.get<ActivitiesListResponse>(url, { withCredentials: true })).then(
      response => {
        const items = response.items;
        return descending ? items : items.slice().reverse();
      }
    );
  }

  public getById(id: number | string): Promise<Activity> {
    const url = `${environment.backendBaseUrl}/api/activities/${id}`;
    return firstValueFrom(this.httpClient.get<Activity>(url, { withCredentials: true }));
  }

  public count(): Promise<number> {
    const url = `${environment.backendBaseUrl}/api/activities?limit=1`;
    return firstValueFrom(
      this.httpClient.get<ActivitiesListResponse>(url, { withCredentials: true })
    ).then(response => response.total);
  }
}
