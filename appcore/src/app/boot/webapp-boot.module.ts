import { ErrorHandler, NgModule } from "@angular/core";
import { MENU_ITEMS_PROVIDER } from "../shared/services/menu-items/menu-items-provider.interface";
import { WebappMenuItemsProvider } from "../shared/services/menu-items/impl/webapp-menu-items-provider.service";
import { TOP_BAR_COMPONENT } from "../top-bar/top-bar.component";
import { WebappTopBarComponent } from "../top-bar/webapp-top-bar.component";
import { AppLoadService } from "../app-load/app-load.service";
import { WebappLoadService } from "../app-load/webapp/webapp-load.service";
import { APP_MORE_MENU_COMPONENT } from "../app-more-menu/app-more-menu.component";
import { WebappAppMoreMenuComponent } from "../app-more-menu/webapp-more-menu.component";
import { SYNC_BAR_COMPONENT } from "../sync-bar/sync-bar.component";
import { WebappSyncBarComponent } from "../sync-bar/webapp-sync-bar.component";
import { ExtensionRecalculateActivitiesBarComponent } from "../recalculate-activities-bar/extension-recalculate-activities-bar.component";
import { RECALCULATE_ACTIVITIES_BAR_COMPONENT } from "../recalculate-activities-bar/recalculate-activities-bar.component";
import { SYNC_MENU_COMPONENT } from "../sync-menu/sync-menu.component";
import { WebappSyncMenuComponent } from "../sync-menu/webapp/webapp-sync-menu.component";
import { WebappRoutingModule } from "../shared/modules/routing/webapp-routing.module";
import { CoreModule } from "../core/core.module";
import { AppService } from "../shared/services/app-service/app.service";
import { WebappAppService } from "../shared/services/app-service/webapp/webapp-app.service";
import { UPDATE_BAR_COMPONENT } from "../update-bar/update-bar.component";
import { ExtensionUpdateBarComponent } from "../update-bar/extension-update-bar.component";
import { WebappSplashScreenComponent } from "../app-load/webapp/webapp-splash-screen.component";
import { SPLASH_SCREEN_COMPONENT } from "../app-load/splash-screen.component";
import { WebappElevateErrorHandler } from "../errors-handler/webapp-elevate-error-handler";

@NgModule({
  imports: [CoreModule, WebappRoutingModule],
  exports: [CoreModule, WebappRoutingModule],
  declarations: [
    WebappSplashScreenComponent,
    ExtensionRecalculateActivitiesBarComponent,
    ExtensionUpdateBarComponent,
    WebappSyncBarComponent,
    WebappTopBarComponent,
    WebappAppMoreMenuComponent,
    WebappSyncMenuComponent
  ],
  providers: [
    { provide: ErrorHandler, useClass: WebappElevateErrorHandler },
    { provide: SPLASH_SCREEN_COMPONENT, useValue: WebappSplashScreenComponent },
    { provide: AppLoadService, useClass: WebappLoadService },
    { provide: AppService, useClass: WebappAppService },
    { provide: MENU_ITEMS_PROVIDER, useClass: WebappMenuItemsProvider },
    { provide: UPDATE_BAR_COMPONENT, useValue: ExtensionUpdateBarComponent },
    { provide: SYNC_BAR_COMPONENT, useValue: WebappSyncBarComponent },
    { provide: RECALCULATE_ACTIVITIES_BAR_COMPONENT, useValue: ExtensionRecalculateActivitiesBarComponent },
    { provide: TOP_BAR_COMPONENT, useValue: WebappTopBarComponent },
    { provide: APP_MORE_MENU_COMPONENT, useValue: WebappAppMoreMenuComponent },
    { provide: SYNC_MENU_COMPONENT, useValue: WebappSyncMenuComponent }
  ]
})
export class TargetBootModule {}
