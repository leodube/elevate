import { ElevateErrorHandler } from "./elevate-error-handler";
import { Inject, Injectable, NgZone } from "@angular/core";
import { VersionsProvider } from "../shared/services/versions/versions-provider";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom } from "rxjs";
import { LoggerService } from "../shared/services/logging/logger.service";
import { GotItDialogComponent } from "../shared/dialogs/got-it-dialog/got-it-dialog.component";
import { GotItDialogDataModel } from "../shared/dialogs/got-it-dialog/got-it-dialog-data.model";

@Injectable({
  providedIn: "root"
})
export class WebappElevateErrorHandler extends ElevateErrorHandler {
  constructor(
    @Inject(VersionsProvider) public readonly versionsProvider: VersionsProvider,
    @Inject(MatDialog) public readonly dialog: MatDialog,
    @Inject(MatSnackBar) public readonly snackBar: MatSnackBar,
    @Inject(LoggerService) public readonly loggerService: LoggerService,
    @Inject(NgZone) private readonly ngZone: NgZone
  ) {
    super(versionsProvider, dialog, snackBar, loggerService);
  }

  public onErrorHandled(error: Error): void {}

  public displayViewErrorAction(errorMessage: string, error: Error): void {
    this.ngZone.run(() => {
      firstValueFrom(this.snackBar.open(errorMessage, "View").onAction())
        .then(() => {
          this.dialog.open(GotItDialogComponent, {
            data: {
              title: `${errorMessage}.`,
              content: `<pre class="mat-caption">${error.stack || error.message || JSON.stringify(error)}</pre>`
            } as GotItDialogDataModel
          });
        })
        .catch(() => {
          // Dismissed without the action being clicked - nothing to show.
        });
    });
  }
}
