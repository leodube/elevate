import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DataStore } from "../../../data-store/data-store";
import { ActivityService } from "../../activity/activity.service";
import { AthleteService } from "../../athlete/athlete.service";
import { LoggerService } from "../../logging/logger.service";
import { StreamsService } from "../../streams/streams.service";
import { UserSettingsService } from "../../user-settings/user-settings.service";
import { VersionsProvider } from "../../versions/versions-provider";
import { SyncState } from "../sync-state.enum";
import { SyncService } from "../sync.service";
import { environment } from "../../../../../environments/environment";

interface SyncStatusResponse {
  isSyncing: boolean;
  lastSyncedAt: string | null;
}

/**
 * HTTP-backed against webapp/server's /api/sync/*. Sync itself runs
 * entirely server-side (the connector, compute pipeline, and the ~2hr
 * background timer all live in webapp/server) - this class is a thin
 * client that triggers it and reports status, not something that performs
 * sync work itself the way the desktop/extension SyncServices do.
 *
 * backup()/restore()/stop() are not supported by design, not oversight:
 * webapp/server's Postgres database already IS the durable store (unlike
 * desktop/extension, which back up/restore because local LokiJS storage
 * is the only copy of the data). A Postgres-level backup/export is a
 * legitimate future feature but is a server-side concern, not something
 * this client-side method should attempt.
 */
@Injectable()
export class WebappSyncService extends SyncService<void> {
  constructor(
    @Inject(VersionsProvider) public readonly versionsProvider: VersionsProvider,
    @Inject(DataStore) public readonly dataStore: DataStore<object>,
    @Inject(ActivityService) public readonly activityService: ActivityService,
    @Inject(StreamsService) public readonly streamsService: StreamsService,
    @Inject(AthleteService) public readonly athleteService: AthleteService,
    @Inject(UserSettingsService) public readonly userSettingsService: UserSettingsService,
    @Inject(LoggerService) public readonly logger: LoggerService,
    @Inject(HttpClient) private readonly httpClient: HttpClient
  ) {
    super(versionsProvider, dataStore, activityService, streamsService, athleteService, userSettingsService, logger);
  }

  public sync(fastSync: boolean = false, forceSync: boolean = false): Promise<void> {
    // fastSync/forceSync aren't meaningful here - the server-side connector
    // always does incremental sync from its own watermark (see
    // IntervalsConnector.syncNew() in webapp/server); there's no client-side
    // sync-mode distinction to make. Accepted only to match the abstract
    // signature that redirect() below calls with two arguments.
    this.isSyncing$.next(true);
    const url = `${environment.backendBaseUrl}/api/sync/trigger`;
    return firstValueFrom(this.httpClient.post(url, {}, { withCredentials: true }))
      .then(() => undefined)
      .finally(() => {
        // The trigger endpoint returns immediately (202) - sync runs in
        // the background server-side. isSyncing$ here just reflects "a
        // trigger was sent", not completion; poll getSyncState() for the
        // real state.
        this.isSyncing$.next(false);
      });
  }

  public getSyncState(): Promise<SyncState> {
    const url = `${environment.backendBaseUrl}/api/sync/status`;
    return Promise.all([
      firstValueFrom(this.httpClient.get<SyncStatusResponse>(url, { withCredentials: true })),
      this.activityService.count()
    ]).then(([status, activitiesCount]) => {
      if (!status.lastSyncedAt && activitiesCount === 0) {
        return SyncState.NOT_SYNCED;
      }
      if (!status.lastSyncedAt && activitiesCount > 0) {
        return SyncState.PARTIALLY_SYNCED;
      }
      return SyncState.SYNCED;
    });
  }

  public redirect(): void {
    this.sync(false, false);
  }

  public stop(): Promise<void> {
    return Promise.reject("Stopping an in-progress sync is not supported - it runs server-side on a timer.");
  }

  public clearSyncTime(): Promise<void> {
    return Promise.reject(
      "Not supported in the webapp target - webapp/server's Postgres database is the durable store."
    );
  }

  public backup(): Promise<{ filename: string; size: number }> {
    return Promise.reject(
      "Not supported in the webapp target - webapp/server's Postgres database is the durable store, " +
        "not a local copy that needs backing up."
    );
  }

  public restore(): Promise<void> {
    return Promise.reject("Not supported in the webapp target - import data via the intervals.icu connector instead.");
  }
}
