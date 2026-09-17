import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { SyncMenuComponent } from "../sync-menu.component";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SyncState } from "../../shared/services/sync/sync-state.enum";
import { WebappSyncService } from "../../shared/services/sync/impl/webapp-sync.service";
import { SyncService } from "../../shared/services/sync/sync.service";
import { AppService } from "../../shared/services/app-service/app.service";
import { WebappAppService } from "../../shared/services/app-service/webapp/webapp-app.service";
import { WebappAuthService } from "../../webapp/auth/webapp-auth.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-webapp-sync-menu",
  template: `
    <div *ngIf="syncState !== null">
      <button
        mat-button
        [disabled]="webappAppService.isSyncing"
        color="primary"
        (click)="onSync()"
        matTooltip="Sync now"
      >
        <mat-icon fontSet="material-icons-outlined">sync</mat-icon>
        Sync now
      </button>
    </div>
  `
})
export class WebappSyncMenuComponent extends SyncMenuComponent implements OnInit, OnDestroy {
  private authSubscription: Subscription;

  constructor(
    @Inject(AppService) public readonly webappAppService: WebappAppService,
    @Inject(Router) protected readonly router: Router,
    @Inject(SyncService) protected readonly webappSyncService: WebappSyncService,
    @Inject(MatDialog) protected readonly dialog: MatDialog,
    @Inject(MatSnackBar) protected readonly snackBar: MatSnackBar,
    @Inject(WebappAuthService) private readonly authService: WebappAuthService
  ) {
    super(webappAppService, router, webappSyncService, dialog, snackBar);
  }

  public ngOnInit(): void {
    this.historyChangesSub = this.webappAppService.historyChanges$.subscribe(() => {
      this.maybeUpdateSyncStatus();
    });

    this.authSubscription = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.updateSyncStatus();
      } else {
        this.syncState = null;
      }
    });
  }

  public ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    super.ngOnDestroy();
  }

  private maybeUpdateSyncStatus(): void {
    if (this.authService.isAuthenticated$.value) {
      this.updateSyncStatus();
    }
  }

  protected updateSyncStatus(): void {
    this.webappSyncService.getSyncState().then(
      (syncState: SyncState) => {
        this.syncState = syncState;
      },
      () => {
        this.syncState = null;
      }
    );
  }

  public onSync(): void {
    this.webappSyncService.redirect();
  }

  public onBackup(): void {
    this.snackBar.open("Backup isn't needed in the webapp target - your data lives in Postgres.", "Close", {
      duration: 5000
    });
  }

  public onRestore(): void {
    this.snackBar.open(
      "Restore isn't supported in the webapp target - use the intervals.icu connector instead.",

      "Close",
      {
        duration: 5000
      }
    );
  }
}
