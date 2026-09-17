import { Component, HostBinding, Inject, OnDestroy, OnInit } from "@angular/core";
import { SyncStatusResponse } from "@elevate/shared/models/sync/sync-progress.model";
import moment from "moment";
import { Subscription } from "rxjs";
import { WebappSyncService } from "../shared/services/sync/impl/webapp-sync.service";
import { SyncService } from "../shared/services/sync/sync.service";
import { SyncBarComponent } from "./sync-bar.component";

@Component({
  selector: "app-webapp-sync-bar",
  template: `
    <div class="app-sync-bar">
      <div fxLayout="row" fxLayoutAlign="space-between center" class="ribbon">
        <div fxLayout="column" fxLayoutAlign="center start">
          <span fxFlex class="mat-body-1">
            <span *ngIf="currentActivityName">{{ currentActivityDate }}: {{ currentActivityName }}</span>
            <span *ngIf="!currentActivityName && statusText">{{ statusText }}</span>
          </span>
          <span fxFlex class="mat-caption" *ngIf="totalFound !== null && processedCount > 0">
            {{ processedCount }} new{{ skippedCount > 0 ? " (" + skippedCount + " already up to date)" : "" }} /
            {{ totalFound }} found
          </span>
          <span fxFlex class="mat-caption sync-error" *ngIf="errorMessage">Error: {{ errorMessage }}</span>
        </div>
        <div fxLayout="row" fxLayoutAlign="space-between center">
          <button *ngIf="!hiddenCloseButton" mat-icon-button (click)="onActionClose()">
            <mat-icon fontSet="material-icons-outlined">close</mat-icon>
          </button>
        </div>
      </div>
    </div>
    <mat-progress-bar *ngIf="isSyncing" mode="indeterminate"></mat-progress-bar>
  `,
  styles: [
    `
      .ribbon {
        padding: 10px 20px;
      }
      .sync-error {
        color: #f44336;
      }
    `
  ]
})
export class WebappSyncBarComponent extends SyncBarComponent implements OnInit, OnDestroy {
  @HostBinding("hidden")
  public hiddenBar = true;
  public hiddenCloseButton = true;
  public isSyncing = false;
  public statusText: string = null;
  public currentActivityName: string = null;
  public currentActivityDate: string = null;
  public totalFound: number | null = null;
  public processedCount = 0;
  public skippedCount = 0;
  public errorMessage: string = null;

  private statusSub: Subscription;
  private lastIsSyncing = false;

  constructor(@Inject(SyncService) private readonly webappSyncService: WebappSyncService) {
    super();
  }

  public ngOnInit(): void {
    this.statusSub = this.webappSyncService.syncStatus$.subscribe(status => this.applyStatus(status));
  }

  public ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  private applyStatus(status: SyncStatusResponse): void {
    if (status.isSyncing && !this.lastIsSyncing) {
      this.hiddenBar = false;
      this.hiddenCloseButton = true;
      this.errorMessage = null;
    }
    this.lastIsSyncing = status.isSyncing;

    this.isSyncing = status.isSyncing;
    this.totalFound = status.totalFound;
    this.processedCount = status.processedCount;
    this.skippedCount = status.skippedCount;

    if (status.currentActivity) {
      this.currentActivityName = status.currentActivity.name;
      this.currentActivityDate = moment(status.currentActivity.startTime).format("ll");
    } else {
      this.currentActivityName = null;
      this.currentActivityDate = null;
    }

    if (status.errors.length > 0) {
      this.errorMessage = status.errors[status.errors.length - 1].message;
    }

    if (!status.isSyncing) {
      if (status.errors.length > 0) {
        this.statusText = "Sync stopped - see error below";
      } else if (!status.completedAt) {
        this.statusText = null;
      } else if (status.processedCount === 0) {
        this.statusText = "Already up to date with intervals.icu";
      } else {
        this.statusText = `Synced ${status.processedCount} new activit${status.processedCount === 1 ? "y" : "ies"}`;
      }
      if (status.completedAt) {
        this.hiddenCloseButton = false;
      }
    } else {
      this.statusText = "Syncing with intervals.icu...";
    }
  }

  public onActionClose(): void {
    this.hiddenBar = true;
  }
}
