import { Inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { OpenResourceResolver } from "../open-resource-resolver";
import { AppRoutes } from "../../../models/app-routes";

@Injectable()
export class WebappOpenResourceResolver extends OpenResourceResolver {
  constructor(
    @Inject(MatSnackBar) protected readonly snackBar: MatSnackBar,
    @Inject(Router) private readonly router: Router
  ) {
    super(snackBar);
  }

  public openLink(url: string): Promise<void> {
    window.open(url, "_blank");
    return Promise.resolve();
  }

  /**
   * Matches DesktopOpenResourceResolver exactly: navigates internally to
   * the activity detail page, not out to an external site. This was
   * previously wrong here - it opened intervals.icu externally, which
   * meant clicking an activity in the (reused) activities list did the
   * wrong thing entirely, since ActivitiesModule's list calls
   * openActivities() -> openActivity() per row to navigate to detail.
   * Opening intervals.icu externally is a separate concern (viewing the
   * activity on its source service) with no dedicated method required by
   * the abstract contract - not implemented here since nothing in the
   * reused UI calls it.
   */
  public openActivity(id: number | string): Promise<boolean> {
    return this.router.navigate([`${AppRoutes.activity}/${id}`]);
  }
}
