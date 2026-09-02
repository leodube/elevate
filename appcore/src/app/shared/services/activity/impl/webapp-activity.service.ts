import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import _ from "lodash";
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
 * of the webapp target. Overrides fetch/findSorted/getById/count/find,
 * which cover everything the activities list/detail views need.
 *
 * find() doesn't call the server with translated filters - it fetches the
 * full findSorted(500) batch and filters/sorts in-memory. The only caller
 * in the webapp build is ActivitiesComponent, which already re-paginates
 * client-side via MatTableDataSource, so this keeps a single request
 * pattern instead of building a generic Loki-query-to-SQL translator for
 * one call site. Only the operators ActivitiesComponent actually sends
 * ($regex, $in, $gte, $lte) are supported - see matchesQuery().
 *
 * v1 GAP, deliberately not overridden (falls through to the parent class's
 * activityDao, which is backed by the empty local WebappDataStore - i.e.
 * these will silently act as if there's no local data):
 *   - findByIds(), findSince(), findByDatedSession()
 *   - insert/insertMany/update/put/removeById/removeByManyIds/clear
 *   - countByType(), countWithConnector() - countByType() in particular
 *     means the activities page's sport filter dropdown starts empty;
 *     it's a synchronous call in ActivitiesComponent's constructor, which
 *     doesn't fit an HTTP-backed implementation without a bigger change
 *     to that component. Flagged for a follow-up, not fixed here.
 *   - createManualEntry() - manual entry doesn't map cleanly onto a
 *     server whose sole data source is intervals.icu; out of v1 scope
 *   - isAthleteSettingsConsistent()/verifyConsistencyWithAthleteSettings()/
 *     nonConsistentActivitiesWithAthleteSettings() - depend on
 *     athleteSnapshotResolver, which itself depends on WebappAthleteService
 *     (also a flagged v1 gap)
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

  public find(
    query?: LokiQuery<Activity & LokiObj>,
    sort?: { propName: keyof Activity; options: Partial<SimplesortOptions> }
  ): Promise<Activity[]> {
    return this.findSorted(true).then(activities => {
      let results = query
        ? activities.filter(activity => WebappActivityService.matchesQuery(activity, query))
        : activities;

      if (sort?.propName) {
        const desc = !!sort.options?.desc;
        results = _.orderBy(results, [sort.propName], [desc ? "desc" : "asc"]);
      }

      return results;
    });
  }

  public getById(id: number | string): Promise<Activity> {
    const url = `${environment.backendBaseUrl}/api/activities/${id}`;
    return firstValueFrom(this.httpClient.get<Activity>(url, { withCredentials: true }));
  }

  public count(): Promise<number> {
    const url = `${environment.backendBaseUrl}/api/activities?limit=1`;
    return firstValueFrom(this.httpClient.get<ActivitiesListResponse>(url, { withCredentials: true })).then(
      response => response.total
    );
  }

  /**
   * Evaluates only the operators ActivitiesComponent.findAndDisplayActivities()
   * actually sends. Not a general Loki query interpreter - extend deliberately
   * if a new caller needs another operator, rather than generalizing upfront.
   */
  private static matchesQuery(activity: Activity, query: LokiQuery<Activity & LokiObj>): boolean {
    return Object.keys(query).every(key => {
      const condition = (query as any)[key];
      const value = (activity as any)[key];

      if (condition && typeof condition === "object") {
        if (condition.$regex) {
          const [pattern, flags] = condition.$regex;
          return new RegExp(pattern, flags).test(value ?? "");
        }
        if (condition.$in) {
          return condition.$in.includes(value);
        }
        if (condition.$gte !== undefined) {
          return value >= condition.$gte;
        }
        if (condition.$lte !== undefined) {
          return value <= condition.$lte;
        }
        if (condition.$gt !== undefined) {
          return value > condition.$gt;
        }
        if (condition.$ne !== undefined) {
          return value !== condition.$ne;
        }
        return true;
      }

      return value === condition;
    });
  }
}
