import { Inject, Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { OpenResourceResolver } from "../open-resource-resolver";

@Injectable()
export class WebappOpenResourceResolver extends OpenResourceResolver {
  constructor(@Inject(MatSnackBar) protected readonly snackBar: MatSnackBar) {
    super(snackBar);
  }

  public openLink(url: string): Promise<void> {
    window.open(url, "_blank");
    return Promise.resolve();
  }

  /**
   * Opens the activity on intervals.icu rather than Strava - intervals.icu
   * is the sole data source for the webapp target, per the connector work.
   * Activity ids are stored as intervals.icu's own ids (e.g. "i123456789").
   */
  public openActivity(id: number | string): Promise<boolean> {
    return this.openLink(`https://intervals.icu/activities/${id}`).then(() => true);
  }
}
