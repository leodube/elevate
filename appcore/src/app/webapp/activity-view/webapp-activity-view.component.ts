import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Location } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { ActivityService } from "../../shared/services/activity/activity.service";
import { StreamsService } from "../../shared/services/streams/streams.service";
import { UserSettingsService } from "../../shared/services/user-settings/user-settings.service";
import moment from "moment";
import _ from "lodash";
import { AppRoutes } from "../../shared/models/app-routes";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatDialog } from "@angular/material/dialog";
import { PaceSensor, SwimmingPaceSensor } from "../../desktop/activity-view/shared/models/sensors/move.sensor";
import { LoggerService } from "../../shared/services/logging/logger.service";
import { ActivityViewService } from "../../desktop/activity-view/shared/activity-view.service";
import { environment } from "../../../environments/environment";
import { GotItDialogComponent } from "../../shared/dialogs/got-it-dialog/got-it-dialog.component";
import { GotItDialogDataModel } from "../../shared/dialogs/got-it-dialog/got-it-dialog-data.model";
import { Subscription, firstValueFrom } from "rxjs";
import { UserSettings } from "@elevate/shared/models/user-settings/user-settings.namespace";
import { WarningException } from "@elevate/shared/exceptions/warning.exception";
import { MeasureSystem } from "@elevate/shared/enums/measure-system.enum";
import { ProcessStreamMode } from "@elevate/shared/sync/compute/stream-processor";
import { Activity, ACTIVITY_FLAGS_DESC_MAP, ActivityFlag } from "@elevate/shared/models/sync/activity.model";
import { ActivityComputer } from "@elevate/shared/sync/compute/activity-computer";
import { ElevateSport } from "@elevate/shared/enums/elevate-sport.enum";
import { Streams } from "@elevate/shared/models/activity-data/streams.model";
import { Time } from "@elevate/shared/tools/time";
import { Constant } from "@elevate/shared/constants/constant";
import { RecalculateProgress } from "@elevate/shared/models/sync/recalculate-progress.model";
import DesktopUserSettings = UserSettings.DesktopUserSettings;

/**
 * Adapted from desktop's ActivityViewComponent. Differences, all
 * deliberate:
 *
 * - Injects the ABSTRACT ActivityService/UserSettingsService tokens, not
 *   the concrete Desktop* types - desktop's version types them concretely
 *   and calls desktop-only methods (recalculateSingle() via local IPC,
 *   removeById()/update() assuming a local DAO that persists for real).
 * - Edit activity, Delete activity, and Clear flags (the persisting
 *   action) are NOT included - all three ultimately call
 *   activityService.update()/removeById(), which fall through to the
 *   empty local WebappDataStore for webapp (a documented v1 gap - no
 *   backend endpoints exist yet for editing or deleting a synced
 *   activity). Offering buttons that silently don't persist would be
 *   worse than not having them. The flags warning banner itself still
 *   shows (pure display, backed by real stored data) - only its "Clear
 *   flags" persistence action is omitted; the banner's dismiss ("x")
 *   button is unaffected since that's always been local-only UI state.
 * - Recalculate activity now POSTs to the same
 *   /api/activities/recalculate endpoint the recalculate-activities-bar
 *   uses, then polls /api/activities/recalculate/status until this
 *   activity's recalculation finishes, since our recompute runs async
 *   server-side rather than synchronously via local IPC.
 * - "Open in Strava" / "View file location" are removed - intervals.icu
 *   is the sole data source for webapp, there's no Strava or file
 *   connector.
 */
@Component({
  selector: "app-webapp-activity-view",
  templateUrl: "./webapp-activity-view.component.html",
  styleUrls: ["../../desktop/activity-view/activity-view.component.scss"]
})
export class WebappActivityViewComponent implements OnInit, OnDestroy {
  constructor(
    @Inject(ActivatedRoute) private readonly route: ActivatedRoute,
    @Inject(UserSettingsService) private readonly userSettingsService: UserSettingsService,
    @Inject(ActivityService) protected readonly activityService: ActivityService,
    @Inject(StreamsService) protected readonly streamsService: StreamsService,
    @Inject(ActivityViewService) private readonly activityViewService: ActivityViewService,
    @Inject(Router) protected readonly router: Router,
    @Inject(MatSnackBar) protected readonly snackBar: MatSnackBar,
    @Inject(Location) private location: Location,
    @Inject(MatDialog) private readonly dialog: MatDialog,
    @Inject(LoggerService) private readonly logger: LoggerService,
    @Inject(HttpClient) private readonly httpClient: HttpClient
  ) {
    this.activity = null;
    this.typeDisplay = null;
    this.startDateDisplay = null;
    this.athleteSnapshotDisplay = null;
    this.streams = null;
    this.userSettings = null;
    this.hasMapData = false;
    this.displayGraph = false;
    this.displayFlags = true;
    this.isRecalculating = false;
    this.isResyncing = false;
  }

  private static readonly DEVICE_WATCH_SPORTS = [
    ElevateSport.Run,
    ElevateSport.VirtualRun,
    ElevateSport.Swim,
    ElevateSport.Hike,
    ElevateSport.Walk,
    ElevateSport.InlineSkate,
    ElevateSport.NordicSki,
    ElevateSport.Crossfit
  ];

  private static readonly RECALCULATE_POLL_INTERVAL_MS = 1000;
  private static readonly RECALCULATE_POLL_TIMEOUT_MS = 2 * 60 * 1000;

  public activity: Activity;
  public typeDisplay: string;
  public startDateDisplay: string;
  public endDateDisplay: string;
  public athleteSnapshotDisplay: string;
  public streams: Streams;
  public userSettings: DesktopUserSettings;
  public hasMapData: boolean;
  public deviceIcon: string;
  public displayGraph: boolean;
  public displayFlags: boolean;
  public isRecalculating: boolean;
  public isResyncing: boolean;

  /**
   * Displays debug "on map statistics" activity data on graph bound selection
   */
  private selectedGraphBoundsSubscription: Subscription;

  public ngOnInit(): void {
    const activityId = this.route.snapshot.params.id;
    this.loadActivity(activityId);
    this.setupDisplayDebugStatsOnSelectedBounds();
  }

  private loadActivity(activityId: string): Promise<void> {
    this.activity = null;
    this.streams = null;
    this.hasMapData = false;

    return this.activityService
      .getById(activityId)
      .then((activity: Activity) => {
        if (!activity) {
          this.onBack();
          return Promise.reject(new WarningException("Unknown activity"));
        }

        this.activity = activity;
        this.typeDisplay = _.startCase(this.activity.type);
        this.startDateDisplay = moment(this.activity.startTime).format("LLLL");
        this.endDateDisplay = moment(this.activity.endTime).format("LLLL");

        this.deviceIcon =
          WebappActivityViewComponent.DEVICE_WATCH_SPORTS.indexOf(this.activity.type) !== -1 ? "watch" : "smartphone";

        return this.userSettingsService.fetch();
      })
      .then((userSettings: DesktopUserSettings) => {
        this.userSettings = userSettings;
        this.athleteSnapshotDisplay = this.formatAthleteSnapshot(this.activity, this.userSettings.systemUnit);

        return this.streamsService.getProcessedById(ProcessStreamMode.DISPLAY, this.activity.id, {
          type: this.activity.type,
          hasPowerMeter: this.activity.hasPowerMeter,
          isSwimPool: this.activity.isSwimPool,
          athleteSnapshot: this.activity.athleteSnapshot
        });
      })
      .then((streams: Streams) => {
        this.streams = streams;
        this.hasMapData = streams?.latlng?.length > 0;

        this.logger.debug("Activity", this.activity);
        this.logger.debug("Streams", this.streams);
      })
      .catch(err => {
        if (!(err instanceof WarningException)) {
          throw err;
        }
      });
  }

  public getFlagReason(flag: ActivityFlag): string {
    return ACTIVITY_FLAGS_DESC_MAP.get(flag) || null;
  }

  public formatAthleteSnapshot(activity: Activity, systemUnit: MeasureSystem): string {
    const isRide = Activity.isRide(activity.type);
    const isRun = Activity.isRun(activity.type);
    const isSwim = Activity.isSwim(activity.type);

    const athleteSnapshot = activity.athleteSnapshot;

    let snapshotFormatted = `Weight ${athleteSnapshot.athleteSettings.weight}kg`;
    if (this.activity.athleteSnapshot.age) {
      snapshotFormatted += ` - Age ${this.activity.athleteSnapshot.age}`;
    }
    snapshotFormatted += ` - MaxHR ${this.activity.athleteSnapshot.athleteSettings.maxHr}bpm`;
    snapshotFormatted += ` - RestHR ${this.activity.athleteSnapshot.athleteSettings.restHr}bpm`;

    if (this.activity.athleteSnapshot.athleteSettings.lthr.cycling && isRide) {
      snapshotFormatted += ` - Lthr ${this.activity.athleteSnapshot.athleteSettings.lthr.cycling}bpm`;
    } else if (this.activity.athleteSnapshot.athleteSettings.lthr.running && isRun) {
      snapshotFormatted += ` - Lthr ${this.activity.athleteSnapshot.athleteSettings.lthr.running}bpm`;
    } else if (this.activity.athleteSnapshot.athleteSettings.lthr.default) {
      snapshotFormatted += ` - Lthr ${this.activity.athleteSnapshot.athleteSettings.lthr.default}bpm`;
    }

    if (isRide) {
      const cyclingFtp = this.activity.athleteSnapshot.athleteSettings.cyclingFtp;
      snapshotFormatted += ` - Threshold ${cyclingFtp ? cyclingFtp + "w" : "Missing"}`;
    }

    if (isRun) {
      const runningFtp = this.activity.athleteSnapshot.athleteSettings.runningFtp;
      snapshotFormatted += ` - Threshold ${
        runningFtp
          ? PaceSensor.DEFAULT.formatFromStat(runningFtp, this.userSettings.systemUnit) +
            PaceSensor.DEFAULT.getDisplayUnit(systemUnit)
          : "Missing"
      }`;
    }

    if (isSwim) {
      const swimFtpMeterPerMin = this.activity.athleteSnapshot.athleteSettings.swimFtp;
      snapshotFormatted += ` - Threshold ${
        swimFtpMeterPerMin
          ? SwimmingPaceSensor.DEFAULT.formatFromStat(
              (1 / (swimFtpMeterPerMin / 60)) * 1000,
              this.userSettings.systemUnit
            ) + SwimmingPaceSensor.DEFAULT.getDisplayUnit(systemUnit)
          : "Missing"
      }`;
    }

    return snapshotFormatted;
  }

  public onRecalculateActivity(): void {
    this.isRecalculating = true;
    this.snackBar.open("Recalculation in progress...");

    firstValueFrom(
      this.httpClient.post(
        `${environment.backendBaseUrl}/api/activities/recalculate`,
        { activityIds: [this.activity.id] },
        { withCredentials: true }
      )
    )
      .then(() => this.pollRecalculationDone())
      .then(() => this.loadActivity(this.activity.id as string))
      .then(() => {
        this.snackBar.open("Activity has been recalculated", "Ok", { duration: 5000 });
      })
      .catch(() => {
        this.snackBar.open("Failed to recalculate this activity", "Close", { duration: 5000 });
      })
      .finally(() => {
        this.isRecalculating = false;
      });
  }

  private pollRecalculationDone(): Promise<void> {
    const url = `${environment.backendBaseUrl}/api/activities/recalculate/status`;
    const startedAt = Date.now();

    const poll = (): Promise<void> =>
      firstValueFrom(this.httpClient.get<RecalculateProgress>(url, { withCredentials: true })).then(status => {
        if (!status.isRecalculating) {
          return;
        }
        if (Date.now() - startedAt > WebappActivityViewComponent.RECALCULATE_POLL_TIMEOUT_MS) {
          return;
        }
        return new Promise<void>(resolve =>
          setTimeout(resolve, WebappActivityViewComponent.RECALCULATE_POLL_INTERVAL_MS)
        ).then(poll);
      });

    return poll();
  }

  public onResyncActivity(): void {
    this.isResyncing = true;
    this.snackBar.open("Resyncing from intervals.icu...");

    firstValueFrom(
      this.httpClient.post(
        `${environment.backendBaseUrl}/api/activities/${this.activity.id}/resync`,
        {},
        { withCredentials: true }
      )
    )
      .then(() => this.loadActivity(this.activity.id as string))
      .then(() => {
        this.snackBar.open("Activity has been resynced", "Ok", { duration: 5000 });
      })
      .catch(() => {
        this.snackBar.open("Failed to resync this activity", "Close", { duration: 5000 });
      })
      .finally(() => {
        this.isResyncing = false;
      });
  }

  public onBack(): void {
    this.location.back();
  }

  public onConfigureAthleteSettings(): void {
    this.router.navigate([`${AppRoutes.athleteSettings}`]);
  }

  private setupDisplayDebugStatsOnSelectedBounds(): void {
    if (environment.showActivityDebugData) {
      this.selectedGraphBoundsSubscription = this.activityViewService.selectedGraphBounds$.subscribe(selectedBounds => {
        if (!selectedBounds) return;

        let dialogTemplate = "";
        const SEPARATOR = `<div>---------------------------</div>`;

        if (this.streams.distance?.length && this.streams.altitude?.length) {
          const mapDeltaTime = _.round(this.streams.time[selectedBounds[1]] - this.streams.time[selectedBounds[0]], 1);
          const mapDeltaDistance = _.round(
            this.streams.distance[selectedBounds[1]] - this.streams.distance[selectedBounds[0]],
            1
          );
          const mapDeltaElevation = _.round(
            this.streams.altitude[selectedBounds[1]] - this.streams.altitude[selectedBounds[0]],
            1
          );
          const mapGrade = mapDeltaDistance > 0 ? _.round((mapDeltaElevation / mapDeltaDistance) * 100, 2) : 0;
          const processedGradeStream = this.streams.grade_smooth.slice(selectedBounds[0], selectedBounds[1] + 1);
          const processedGradeMean = _.round(_.mean(processedGradeStream), 2);

          dialogTemplate += `<div><strong>Indexes:</strong> ${selectedBounds[0]} to ${selectedBounds[1]}</div>`;
          dialogTemplate += `<div><strong>Map Δ Time:</strong> ${Time.secToMilitary(mapDeltaTime)}</div>`;
          dialogTemplate += `<div><strong>Map Δ Distance:</strong> ${mapDeltaDistance}m</div>`;
          dialogTemplate += `<div><strong>Map Δ Elevation:</strong> ${mapDeltaElevation}m</div>`;
          dialogTemplate += `<div><strong>Grade:</strong> Map ${mapGrade}%; Stream: ${processedGradeMean}%</div>`;
        }

        if (this.streams.velocity_smooth?.length) {
          const selectedSpeedStream = this.streams.velocity_smooth.slice(selectedBounds[0], selectedBounds[1] + 1);
          const selectedSpeedMean = _.round(_.mean(selectedSpeedStream) * Constant.MPS_KPH_FACTOR, 2);
          dialogTemplate += `<div><strong>Avg Speed:</strong> ${selectedSpeedMean}</div>`;
        }

        if (
          this.activity.hasPowerMeter &&
          this.streams.watts?.length &&
          this.streams.watts_calc?.length &&
          localStorage.getItem("DEBUG_EST_VS_REAL_WATTS") === "true"
        ) {
          dialogTemplate += SEPARATOR;

          const streamTime = this.streams.time.slice(selectedBounds[0], selectedBounds[1] + 1);
          const streamPower = this.streams.watts.slice(selectedBounds[0], selectedBounds[1] + 1);
          const streamEstDebugPower = this.streams.watts_calc.slice(selectedBounds[0], selectedBounds[1] + 1);

          const realPowerMean = _.round(_.mean(streamPower));
          const estDebugPowerMean = _.round(_.mean(streamEstDebugPower));
          dialogTemplate += `<div><strong>Power REAL/EST. Avg:</strong> Real Avg ${realPowerMean}w; Est Power: ${estDebugPowerMean}w; </div>`;

          const realNormPower = _.round(ActivityComputer.computeNormalizedPower(streamPower, streamTime));
          const estNormPower = _.round(ActivityComputer.computeNormalizedPower(streamEstDebugPower, streamTime));
          dialogTemplate += `<div><strong>Power REAL/EST. NP:</strong> Real NP ${realNormPower}w; Est NP: ${estNormPower}w; </div>`;
        }

        if (this.streams.watts?.length) {
          dialogTemplate += SEPARATOR;
          const streamTime = this.streams.time.slice(selectedBounds[0], selectedBounds[1] + 1);
          const streamPower = this.streams.watts.slice(selectedBounds[0], selectedBounds[1] + 1);

          const powerMean = _.round(_.mean(streamPower));
          const powerNorm = _.round(ActivityComputer.computeNormalizedPower(streamPower, streamTime));
          dialogTemplate += `<div><strong>Power Avg:</strong> Avg ${powerMean}w</div>`;
          dialogTemplate += `<div><strong>Power NP:</strong> NP ${powerNorm}w</div>`;
        }

        this.dialog.open(GotItDialogComponent, {
          data: { content: dialogTemplate } as GotItDialogDataModel,
          position: { bottom: "50px" },
          backdropClass: ["transparent"]
        });
      });
    }
  }

  public ngOnDestroy(): void {
    if (environment.showActivityDebugData) {
      this.selectedGraphBoundsSubscription.unsubscribe();
    }
  }
}
