import { Component, Inject } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";

export interface BackfillDialogResult {
  startDate: Date;
  resyncExisting: boolean;
}

/**
 * Prompts for a mandatory backfill start date (Jan 1 2000 - today) and a
 * "re-sync existing activities" toggle before triggering
 * WebappSyncService.backfill(). See IntervalsConnector.runSync()'s
 * resyncExisting param for what the toggle actually changes server-side:
 * unchecked (default) skips activities already in the DB - matches
 * runSync()'s existing "skip if already synced" behavior, unchanged;
 * checked removes that skip so existing activities are re-fetched and
 * recomputed too, same as a single-activity resync but for the whole
 * range. Dated athlete settings are applied either way - runSync()
 * already resolves the athlete snapshot per-activity by its own start
 * date for every activity it processes, new or re-synced.
 */
@Component({
  selector: "app-webapp-backfill-dialog",
  template: `
    <h2 mat-dialog-title>Backfill activities</h2>
    <mat-dialog-content style="overflow: visible">
      <mat-form-field appearance="fill" style="width: 100%">
        <mat-label>Backfill from</mat-label>
        <input
          matInput
          [matDatepicker]="startDatePicker"
          [(ngModel)]="startDate"
          [min]="minDate"
          [max]="maxDate"
          placeholder="Choose a start date"
          required
        />
        <mat-datepicker-toggle [for]="startDatePicker" matSuffix></mat-datepicker-toggle>
        <mat-datepicker #startDatePicker></mat-datepicker>
      </mat-form-field>

      <div style="margin-top: 8px; display: flex; align-items: center; gap: 4px">
        <mat-checkbox [(ngModel)]="resyncExisting">Re-sync existing activities</mat-checkbox>
        <mat-icon
          fontSet="material-icons-outlined"
          style="font-size: 18px; cursor: help"
          matTooltip="Selecting this will also re-sync and recalculate activities that already exist in Elevate. Leave this unchecked to only backfill activities that have not been synced to Elevate."
        >
          help_outline
        </mat-icon>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!startDate" (click)="onConfirm()">Backfill</button>
    </mat-dialog-actions>
  `
})
export class WebappBackfillDialogComponent {
  public readonly minDate = new Date(2000, 0, 1);
  public readonly maxDate = new Date();

  public startDate: Date = null;
  public resyncExisting = false;

  constructor(@Inject(MatDialogRef) private readonly dialogRef: MatDialogRef<WebappBackfillDialogComponent>) {}

  public onConfirm(): void {
    if (!this.startDate) {
      return;
    }
    this.dialogRef.close({ startDate: this.startDate, resyncExisting: this.resyncExisting } as BackfillDialogResult);
  }

  public onCancel(): void {
    this.dialogRef.close(null);
  }
}
