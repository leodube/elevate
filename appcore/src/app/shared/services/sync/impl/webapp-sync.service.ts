import { HttpClient } from "@angular/common/http";
import { Inject, Injectable, OnDestroy } from "@angular/core";
import { SyncStatusResponse } from "@elevate/shared/models/sync/sync-progress.model";
import { BehaviorSubject, Subscription, firstValueFrom, interval, of } from "rxjs";
import { catchError, filter, startWith, switchMap, take } from "rxjs/operators";
import { environment } from "../../../../../environments/environment";
import { WebappAuthService } from "../../../../webapp/auth/webapp-auth.service";
import { DataStore } from "../../../data-store/data-store";
import { ActivityService } from "../../activity/activity.service";
import { AthleteService } from "../../athlete/athlete.service";
import { LoggerService } from "../../logging/logger.service";
import { StreamsService } from "../../streams/streams.service";
import { UserSettingsService } from "../../user-settings/user-settings.service";
import { VersionsProvider } from "../../versions/versions-provider";
import { SyncState } from "../sync-state.enum";
import { SyncService } from "../sync.service";

const IDLE_STATUS: SyncStatusResponse = {
  isSyncing: false,
  totalFound: null,
  processedCount: 0,
  skippedCount: 0,
  currentActivity: null,
  errors: [],
  startedAt: null,
  completedAt: null,
  lastSyncedAt: null
};

/**
 * HTTP-backed against webapp/server's /api/sync/*. Sync itself runs
 * server-side; this class triggers it and tracks progress.
 *
 * /api/sync/status is polled only while a sync is being watched for -
 * started by sync(), stopped once a poll confirms THIS run has finished.
 * "Finished" is identified by completedAt changing to a new, non-null
 * value versus what it was right before triggering - not by isSyncing
 * flipping true then false. That matters because there's an inherent gap
 * between the trigger POST returning and the server's runSync() actually
 * resetting its progress state (it awaits a settings read first) - a poll
 * landing in that gap would otherwise get back the PREVIOUS run's
 * completed snapshot and briefly render stale numbers. Any poll response
 * that looks like leftover previous-run data (isSyncing:false and
 * completedAt unchanged) is ignored rather than displayed.
 *
 * A fast sync (nothing new to pull) can also finish inside a single poll
 * interval, meaning isSyncing:true might never actually be observed - the
 * completedAt comparison handles that case too, unlike a scheme that
 * waits to see isSyncing:true before it will accept isSyncing:false.
 *
 * A single status check also runs on construction (gated on auth) purely
 * to recover an in-progress sync after a page refresh.
 *
 * backup()/restore()/stop() are unsupported by design: webapp/server's
 * Postgres database already IS the durable store.
 */
@Injectable()
export class WebappSyncService extends SyncService<void> implements OnDestroy {
  private static readonly POLL_INTERVAL_MS = 750;
  private static readonly MAX_POLL_DURATION_MS = 5 * 60 * 1000; // safety net

  private readonly statusUrl = `${environment.backendBaseUrl}/api/sync/status`;
  private readonly triggerUrl = `${environment.backendBaseUrl}/api/sync/trigger`;

  public readonly syncStatus$ = new BehaviorSubject<SyncStatusResponse>(IDLE_STATUS);

  private pollingSub: Subscription | null = null;
  private pollStartedAt = 0;
  private lastKnownIsSyncing = false;

  constructor(
    @Inject(VersionsProvider) public readonly versionsProvider: VersionsProvider,
    @Inject(DataStore) public readonly dataStore: DataStore<object>,
    @Inject(ActivityService) public readonly activityService: ActivityService,
    @Inject(StreamsService) public readonly streamsService: StreamsService,
    @Inject(AthleteService) public readonly athleteService: AthleteService,
    @Inject(UserSettingsService) public readonly userSettingsService: UserSettingsService,
    @Inject(LoggerService) public readonly logger: LoggerService,
    @Inject(HttpClient) private readonly httpClient: HttpClient,
    @Inject(WebappAuthService) private readonly authService: WebappAuthService
  ) {
    super(versionsProvider, dataStore, activityService, streamsService, athleteService, userSettingsService, logger);

    this.authService.isAuthenticated$
      .pipe(
        filter(isAuthenticated => isAuthenticated),
        take(1)
      )
      .subscribe(() => this.checkStatusOnce());
  }

  private checkStatusOnce(): void {
    firstValueFrom(this.httpClient.get<SyncStatusResponse>(this.statusUrl, { withCredentials: true }))
      .then(status => {
        this.applyStatus(status);
        if (status.isSyncing) {
          this.startPolling(status.completedAt);
        }
      })
      .catch(() => {
        // Nothing to recover from a failed one-off check.
      });
  }

  private startPolling(previousCompletedAt: string | null): void {
    if (this.pollingSub) {
      return; // already watching a run
    }
    this.pollStartedAt = Date.now();

    this.pollingSub = interval(WebappSyncService.POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.httpClient.get<SyncStatusResponse>(this.statusUrl, { withCredentials: true })),
        catchError(() => of(null))
      )
      .subscribe(status => {
        if (!status) {
          return; // transient fetch error - keep polling, don't touch display
        }

        const isLeftoverFromPreviousRun = !status.isSyncing && status.completedAt === previousCompletedAt;
        if (isLeftoverFromPreviousRun) {
          return; // this run hasn't started server-side yet - ignore and keep polling
        }

        this.applyStatus(status);

        const thisRunFinished = !status.isSyncing && status.completedAt !== previousCompletedAt;
        const timedOut = Date.now() - this.pollStartedAt > WebappSyncService.MAX_POLL_DURATION_MS;
        if (thisRunFinished || timedOut) {
          this.stopPolling();
        }
      });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  private applyStatus(status: SyncStatusResponse): void {
    this.syncStatus$.next(status);

    // Edge-triggered on purpose - AppService.historyChanges$ fires
    // verifyHistoryCompliance() on every isSyncing$ false emission.
    if (status.isSyncing !== this.lastKnownIsSyncing) {
      this.lastKnownIsSyncing = status.isSyncing;
      this.isSyncing$.next(status.isSyncing);
    }
  }

  public sync(): Promise<void> {
    const previousCompletedAt = this.syncStatus$.value.completedAt;

    // Optimistic immediate update: there's an unavoidable round trip before
    // the trigger POST resolves and another before the server's runSync()
    // resets its own progress - without this, the bar would keep showing
    // the previous run's numbers for that whole gap.
    this.applyStatus({
      ...IDLE_STATUS,
      isSyncing: true,
      startedAt: new Date().toISOString(),
      lastSyncedAt: this.syncStatus$.value.lastSyncedAt
    });

    this.startPolling(previousCompletedAt);

    return firstValueFrom(this.httpClient.post(this.triggerUrl, {}, { withCredentials: true })).then(() => undefined);
  }

  public getSyncState(): Promise<SyncState> {
    return Promise.all([
      firstValueFrom(this.httpClient.get<SyncStatusResponse>(this.statusUrl, { withCredentials: true })),
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
    this.sync();
  }

  public stop(): Promise<void> {
    return Promise.reject("Stopping an in-progress sync is not supported.");
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

  public ngOnDestroy(): void {
    this.stopPolling();
  }
}
