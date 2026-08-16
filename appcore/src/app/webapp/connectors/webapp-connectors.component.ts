import { HttpClient } from "@angular/common/http";
import { Component, Inject, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

interface IntervalsConnectorSettingsResponse {
  configured: boolean;
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
        ><span *ngIf="settings.lastSyncedAt"> - last synced {{ settings.lastSyncedAt | date: "medium" }}</span>.
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
        <button mat-raised-button color="primary" type="submit" [disabled]="isSaving">Save</button>
      </form>

      <div style="margin-top: 24px">
        <button mat-raised-button color="accent" (click)="onTriggerSync()" [disabled]="isSyncing">
          Sync now
        </button>
        <span *ngIf="isSyncing" class="mat-body-1" style="margin-left: 12px">Syncing...</span>
      </div>
    </div>
  `
})
export class WebappConnectorsComponent implements OnInit {
  public apiKey = "";
  public athleteId = "";
  public isSaving = false;
  public isSyncing = false;
  public settings: IntervalsConnectorSettingsResponse | null = null;

  constructor(
    @Inject(HttpClient) private readonly httpClient: HttpClient,
    @Inject(MatSnackBar) private readonly snackBar: MatSnackBar
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

  public onTriggerSync(): void {
    this.isSyncing = true;
    firstValueFrom(
      this.httpClient.post(`${environment.backendBaseUrl}/api/sync/trigger`, {}, { withCredentials: true })
    )
      .catch(() => {
        this.snackBar.open("Failed to trigger sync", "Close", { duration: 5000 });
      })
      .finally(() => {
        this.isSyncing = false;
        this.refreshSettings();
      });
  }
}
