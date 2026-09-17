import { HttpClient } from "@angular/common/http";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { firstValueFrom, interval, Subscription } from "rxjs";
import { filter, switchMap, take } from "rxjs/operators";
import { ActivityService } from "../shared/services/activity/activity.service";
import { UserSettingsService } from "../shared/services/user-settings/user-settings.service";
import { LoggerService } from "../shared/services/logging/logger.service";
import { WebappAuthService } from "../webapp/auth/webapp-auth.service";
import { GotItDialogComponent } from "../shared/dialogs/got-it-dialog/got-it-dialog.component";
import { GotItDialogDataModel } from "../shared/dialogs/got-it-dialog/got-it-dialog-data.model";
import { RecalculateActivitiesBarComponent } from "./recalculate-activities-bar.component";
import { RecalculateProgress } from "@elevate/shared/models/sync/recalculate-progress.model";
import { environment } from "../../environments/environment";
import moment from "moment";

const POLL_INTERVAL_MS = 1500;

/**
 * Progress is polled from POST/GET /api/activities/recalculate
 */
@Component({
  selector: "app-webapp-recalculate-activities-bar",
  template: `
    <div class="app-recalculate-activities-bar">
      <!--Missing stress scores detected on some activities-->
      <div *ngIf="!hideSettingsLacksWarning" fxLayout="row" fxLayoutAlign="space-between center" class="ribbon">
        <div fxLayout="column" fxLayoutAlign="center start">
          <span>
            <mat-icon fontSet="material-icons-outlined" [style.vertical-align]="'bottom'">looks_one</mat-icon>
            Missing stress scores detected on some activities. You probably forgot some functional thresholds in dated
            athlete settings.
          </span>
        </div>
        <div fxLayout="row" fxLayoutAlign="space-between center">
          <button mat-flat-button color="accent" (click)="onShowActivitiesWithSettingsLacks()">Details</button>
          <button
            *ngIf="hideGoToAthleteSettingsButton"
            mat-flat-button
            color="accent"
            (click)="onEditAthleteSettingsFromSettingsLacksIssue()"
          >
            Fix settings
          </button>
          <button
            mat-icon-button
            (click)="onHideActivitiesWithSettingsLacks()"
            matTooltip="Don't remind me this warning"
          >
            <mat-icon fontSet="material-icons-outlined">notifications_off</mat-icon>
          </button>
          <button mat-icon-button (click)="onCloseSettingsLacksWarning()">
            <mat-icon fontSet="material-icons-outlined">close</mat-icon>
          </button>
        </div>
      </div>

      <!--Non consistent warning message-->
      <div *ngIf="!hideSettingsConsistencyWarning" fxLayout="row" fxLayoutAlign="space-between center" class="ribbon">
        <div fxLayout="column" fxLayoutAlign="center start">
          <span>
            <mat-icon fontSet="material-icons-outlined" [style.vertical-align]="'bottom'">{{
              hideSettingsLacksWarning ? "looks_one" : "looks_two"
            }}</mat-icon>
            Some of your activities need to be recalculated according to athlete settings changes.
          </span>
        </div>
        <div fxLayout="row" fxLayoutAlign="space-between center">
          <button mat-flat-button color="accent" (click)="onFixActivities()">Recalculate</button>
          <button mat-icon-button (click)="onHideActivitiesRecalculation()" matTooltip="Don't remind me this warning">
            <mat-icon fontSet="material-icons-outlined">notifications_off</mat-icon>
          </button>
          <button mat-icon-button (click)="onCloseSettingsConsistencyWarning()">
            <mat-icon fontSet="material-icons-outlined">close</mat-icon>
          </button>
        </div>
      </div>

      <!--Recalculate activities section-->
      <div *ngIf="!hideRecalculation" fxLayout="row" fxLayoutAlign="space-between center" class="ribbon">
        <div fxLayout="column" fxLayoutAlign="center start">
          <span fxFlex class="mat-body-1" *ngIf="statusText">{{ statusText }}</span>
          <span fxFlex class="mat-caption">{{ processed }}/{{ toBeProcessed }} activities recalculated.</span>
        </div>
        <div fxLayout="row" fxLayoutAlign="space-between center" *ngIf="processed === toBeProcessed">
          <button mat-icon-button (click)="onCloseRecalculation()">
            <mat-icon fontSet="material-icons-outlined">close</mat-icon>
          </button>
        </div>
      </div>
    </div>
    <mat-progress-bar *ngIf="isRecalculating" mode="indeterminate"></mat-progress-bar>
  `,
  styles: [
    `
      .ribbon {
        padding: 10px 20px;
      }

      button {
        margin-left: 10px;
      }
    `
  ]
})
export class WebappRecalculateActivitiesBarComponent
  extends RecalculateActivitiesBarComponent
  implements OnInit, OnDestroy
{
  public hideRecalculation = true;
  public isRecalculating = false;
  public statusText: string;
  public processed: number;
  public toBeProcessed: number;

  private pollSubscription: Subscription | null = null;

  constructor(
    @Inject(Router) protected readonly router: Router,
    @Inject(ActivityService) protected readonly activityService: ActivityService,
    @Inject(UserSettingsService) protected readonly userSettingsService: UserSettingsService,
    @Inject(MatDialog) protected readonly dialog: MatDialog,
    @Inject(LoggerService) protected readonly logger: LoggerService,
    @Inject(HttpClient) private readonly httpClient: HttpClient,
    @Inject(WebappAuthService) private readonly authService: WebappAuthService
  ) {
    super(router, activityService, userSettingsService, dialog);
  }

  public ngOnInit(): void {
    this.authService.isAuthenticated$
      .pipe(
        filter(isAuthenticated => isAuthenticated),
        take(1)
      )
      .subscribe(() => super.ngOnInit());
  }

  public ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  public onFixActivities(): void {
    super.onFixActivities();
    this.startRecalculation();
  }

  private startRecalculation(): void {
    this.activityService
      .nonConsistentActivitiesWithAthleteSettings()
      .then((activityIds: (number | string)[]) => {
        if (activityIds.length === 0) {
          this.dialog.open(GotItDialogComponent, {
            data: { content: "No activities need recalculating." } as GotItDialogDataModel
          });
          return;
        }

        return firstValueFrom(
          this.httpClient.post(
            `${environment.backendBaseUrl}/api/activities/recalculate`,
            { activityIds },
            { withCredentials: true }
          )
        ).then(() => {
          this.showRecalculation();
          this.startPolling();
        });
      })
      .catch(error => {
        this.logger.error(error);
        this.dialog.open(GotItDialogComponent, { data: { content: error } as GotItDialogDataModel });
      });
  }

  private startPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.fetchStatus()))
      .subscribe();
  }

  private fetchStatus(): Promise<void> {
    const url = `${environment.backendBaseUrl}/api/activities/recalculate/status`;
    return firstValueFrom(this.httpClient.get<RecalculateProgress>(url, { withCredentials: true })).then(status => {
      this.applyStatus(status);
    });
  }

  private applyStatus(status: RecalculateProgress): void {
    this.isRecalculating = status.isRecalculating;
    this.processed = status.processedCount;
    this.toBeProcessed = status.totalToProcess;

    this.statusText = status.currentActivity
      ? moment(status.currentActivity.startTime).format("ll") + ": " + status.currentActivity.name
      : status.isRecalculating
        ? "Recalculating..."
        : "Recalculation done.";

    if (!status.isRecalculating) {
      this.pollSubscription?.unsubscribe();
      this.pollSubscription = null;
    }
  }

  public showRecalculation(): void {
    this.hideRecalculationBar = false;
    this.hideRecalculation = false;
  }

  public onCloseRecalculation(): void {
    this.hideRecalculation = true;
  }
}
