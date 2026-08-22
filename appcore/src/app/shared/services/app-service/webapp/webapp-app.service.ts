import { Inject, Injectable } from "@angular/core";
import { AppService } from "../app.service";
import { ActivityService } from "../../activity/activity.service";
import { SyncService } from "../../sync/sync.service";
import { WebappAuthService } from "../../../../webapp/auth/webapp-auth.service";

@Injectable()
export class WebappAppService extends AppService {
  constructor(
    @Inject(ActivityService) protected readonly activityService: ActivityService,
    @Inject(SyncService) public readonly syncService: SyncService<any>,
    @Inject(WebappAuthService) private readonly authService: WebappAuthService
  ) {
    super(activityService, syncService);

    this.isAuthenticated = false;
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;
    });
  }

  public init(): void {
    this.loadTheme();
    this.isAppLoaded = true;
  }
}
