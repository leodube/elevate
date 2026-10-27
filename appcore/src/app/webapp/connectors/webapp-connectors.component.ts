import { HttpClient } from "@angular/common/http";
import { Component, Inject, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import { SyncService } from "../../shared/services/sync/sync.service";
import { WebappSyncService } from "../../shared/services/sync/impl/webapp-sync.service";
import { BackfillDialogResult, WebappBackfillDialogComponent } from "./webapp-backfill-dialog.component";

interface IntervalsConnectorSettingsResponse {
  configured: boolean;
  apiKey: string | null;
  athleteId: string | null;
  lastSyncedAt: string | null;
}

@Component({
  selector: "app-webapp-connectors",
  template: `
    <div class="mat-elevation-z2" style="padding: 24px; max-width: 480px; margin: 24px auto;">
      <h2 class="mat-h2">intervals.icu connection</h2>

      <p *ngIf="settings?.configured" class="mat-body-1">
        Connected<span *ngIf="settings.athleteId"> as {{ settings.athleteId }}</span
        ><span *ngIf="settings.lastSyncedAt"> - last synced {{ settings.lastSyncedAt | date: "medium" }}</span
        >.
      </p>
      <p *ngIf="settings && !settings.configured" class="mat-body-1">Not configured yet.</p>

      <form (ngSubmit)="onSaveSettings()">
        <mat-form-field appearance="fill" style="width: 100%">
          <mat-label>intervals.icu API key</mat-label>
          <input matInput type="password" name="apiKey" [(ngModel)]="apiKey" required />
        </mat-form-field>
        <mat-form-field appearance="fill" style="width: 100%">
          <mat-label>Athlete ID (optional)</mat-label>
          <input matInput name="athleteId" [(ngModel)]="athleteId" />
        </mat-form-field>

        <div fxLayout="row" fxLayoutAlign="start center" style="gap: 12px; margin-top: 8px">
          <button mat-raised-button color="primary" type="submit" [disabled]="isSaving">Save</button>
          <button
            mat-raised-button
            color="accent"
            type="button"
            (click)="onTriggerBackfill()"
            [disabled]="isBackfilling"
          >
            Backfill activities
          </button>
          <span *ngIf="isBackfilling" class="mat-body-1">Syncing...</span>
        </div>
      </form>
    </div>
  `
})
export class WebappConnectorsComponent implements OnInit {
  public apiKey = "";
  public athleteId = "";
  public isSaving = false;
  public isBackfilling = false;
  public settings: IntervalsConnectorSettingsResponse | null = null;

  constructor(
    @Inject(HttpClient) private readonly httpClient: HttpClient,
    @Inject(MatSnackBar) private readonly snackBar: MatSnackBar,
    @Inject(MatDialog) private readonly dialog: MatDialog,
    @Inject(SyncService) private readonly webappSyncService: WebappSyncService
  ) {}

  public ngOnInit(): void {
    this.refreshSettings();
  }

  public refreshSettings(): void {
    firstValueFrom(
      this.httpClient.get<IntervalsConnectorSettingsResponse>(
        `${environment.backendBaseUrl}/api/settings/intervals-connector`,
        { withCredentials: true }
      )
    ).then(settings => {
      this.settings = settings;
      this.apiKey = settings.apiKey ?? "";
      this.athleteId = settings.athleteId ?? "";
    });
  }

  public onSaveSettings(): void {
    this.isSaving = true;
    firstValueFrom(
      this.httpClient.put(
        `${environment.backendBaseUrl}/api/settings/intervals-connector`,
        { apiKey: this.apiKey, athleteId: this.athleteId || null },
        { withCredentials: true }
      )
    )
      .then(() => {
        this.apiKey = "";
        this.snackBar.open("Saved", "Close", { duration: 3000 });
        this.refreshSettings();
      })
      .catch(() => {
        this.snackBar.open("Failed to save settings", "Close", { duration: 5000 });
      })
      .finally(() => {
        this.isSaving = false;
      });
  }

  public onTriggerBackfill(): void {
    const dialogRef = this.dialog.open(WebappBackfillDialogComponent, {
      minWidth: "360px"
    });

    dialogRef.afterClosed().subscribe((result: BackfillDialogResult | null) => {
      if (!result) {
        return;
      }

      this.isBackfilling = true;
      this.webappSyncService
        .backfill(result.startDate, result.resyncExisting)
        .then(() => {
          this.snackBar.open("Backfill started - watch the sync bar for progress.", "Close", { duration: 5000 });
        })
        .catch(() => {
          this.snackBar.open("Failed to trigger backfill", "Close", { duration: 5000 });
        })
        .finally(() => {
          this.isBackfilling = false;
          this.refreshSettings();
        });
    });
  }
}
