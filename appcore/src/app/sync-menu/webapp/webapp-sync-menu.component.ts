import { Component, Inject, OnInit } from "@angular/core";
import { SyncMenuComponent } from "../sync-menu.component";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SyncState } from "../../shared/services/sync/sync-state.enum";
import { WebappSyncService } from "../../shared/services/sync/impl/webapp-sync.service";
import { SyncService } from "../../shared/services/sync/sync.service";
import { AppService } from "../../shared/services/app-service/app.service";
import { WebappAppService } from "../../shared/services/app-service/webapp/webapp-app.service";

/**
 * Simplified relative to ExtensionSyncMenuComponent: no backup/restore
 * (rejected by WebappSyncService by design - Postgres is the durable
 * store), and a single "Sync now" action rather than fast/full/clear
 * distinctions, since the server-side connector always does incremental
 * sync from its own watermark. Backfill exists as a separate
 * POST /api/sync/backfill endpoint on webapp/server but isn't wired to
 * this menu yet - SyncService's abstract sync() signature doesn't carry a
 * "backfill" concept, and adding one is future work, not v1 scope.
 */
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
export class WebappSyncMenuComponent extends SyncMenuComponent implements OnInit {
  constructor(
    @Inject(AppService) public readonly webappAppService: WebappAppService,
    @Inject(Router) protected readonly router: Router,
    @Inject(SyncService) protected readonly webappSyncService: WebappSyncService,
    @Inject(MatDialog) protected readonly dialog: MatDialog,
    @Inject(MatSnackBar) protected readonly snackBar: MatSnackBar
  ) {
    super(webappAppService, router, webappSyncService, dialog, snackBar);
  }

  public ngOnInit(): void {
    super.ngOnInit();
  }

  protected updateSyncStatus(): void {
    this.webappSyncService.getSyncState().then((syncState: SyncState) => {
      this.syncState = syncState;
    });
  }

  public onSync(): void {
    this.webappSyncService.sync(false, false);
  }

  public onBackup(): void {
    this.snackBar.open("Backup isn't needed in the webapp target - your data lives in Postgres.", "Close", {
      duration: 5000
    });
  }

  public onRestore(): void {
    this.snackBar.open("Restore isn't supported in the webapp target - use the intervals.icu connector instead.", "Close", {
      duration: 5000
    });
  }
}
