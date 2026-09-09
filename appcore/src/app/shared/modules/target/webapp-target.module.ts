import { NgModule } from "@angular/core";
import { CoreModule } from "../../../core/core.module";
import { DataStore } from "../../data-store/data-store";
import { WebappDataStore } from "../../data-store/impl/webapp-data-store.service";
import { ActivityService } from "../../services/activity/activity.service";
import { WebappActivityService } from "../../services/activity/impl/webapp-activity.service";
import { VersionsProvider } from "../../services/versions/versions-provider";
import { WebappVersionsProvider } from "../../services/versions/impl/webapp-versions-provider.service";
import { OPEN_RESOURCE_RESOLVER } from "../../services/links-opener/open-resource-resolver";
import { WebappOpenResourceResolver } from "../../services/links-opener/impl/webapp-open-resource-resolver.service";
import { SyncService } from "../../services/sync/sync.service";
import { WebappSyncService } from "../../services/sync/impl/webapp-sync.service";
import { WebappRoutingModule } from "../routing/webapp-routing.module";
import { UserSettingsService } from "../../services/user-settings/user-settings.service";
import { WebappUserSettingsService } from "../../services/user-settings/webapp/webapp-user-settings.service";
import { AthleteService } from "../../services/athlete/athlete.service";
import { WebappAthleteService } from "../../services/athlete/webapp/webapp-athlete.service";
import { WindowService } from "../../services/window/window.service";
import { WebappWindowService } from "../../services/window/webapp-window.service";
import { WebappHttpInterceptor } from "../../../webapp/auth/webapp-http.interceptor";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { WebappLoginComponent } from "../../../webapp/login/webapp-login.component";
import { WebappConnectorsComponent } from "../../../webapp/connectors/webapp-connectors.component";
import { WebappActivitiesViewPreferencesService } from "../../../webapp/activities/webapp-activities-view-preferences.service";

/**
 * The DI seam for the webapp target - mirrors DesktopTargetModule /
 * ExtensionTargetModule exactly, just swapping in HTTP-backed
 * implementations against webapp/server instead of Electron IPC or
 * chrome.storage. See WebappActivityService/WebappSyncService for what's
 * genuinely wired up vs the flagged v1 gaps (WebappAthleteService/
 * WebappUserSettingsService still operate against the local no-op
 * WebappDataStore).
 */
@NgModule({
  imports: [CoreModule, WebappRoutingModule],
  exports: [CoreModule, WebappRoutingModule],
  declarations: [WebappLoginComponent, WebappConnectorsComponent],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: WebappHttpInterceptor, multi: true },
    { provide: WindowService, useClass: WebappWindowService },
    { provide: AthleteService, useClass: WebappAthleteService },
    { provide: UserSettingsService, useClass: WebappUserSettingsService },
    { provide: DataStore, useClass: WebappDataStore },
    { provide: ActivityService, useClass: WebappActivityService },
    { provide: WebappActivityService, useExisting: ActivityService },
    { provide: VersionsProvider, useClass: WebappVersionsProvider },
    { provide: OPEN_RESOURCE_RESOLVER, useClass: WebappOpenResourceResolver },
    { provide: SyncService, useClass: WebappSyncService },
    WebappActivitiesViewPreferencesService
  ]
})
export class TargetModule {}
