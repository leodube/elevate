import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AppRoutes } from "../../models/app-routes";
import { WebappAuthGuard } from "../../../webapp/auth/webapp-auth.guard";
import { WebappLoginComponent } from "../../../webapp/login/webapp-login.component";
import { WebappConnectorsComponent } from "../../../webapp/connectors/webapp-connectors.component";

const routes: Routes = [
  {
    path: "login",
    component: WebappLoginComponent
  },
  {
    path: AppRoutes.activities,
    canActivate: [WebappAuthGuard],
    loadChildren: () => import("../../../activities/activities.module").then(module => module.ActivitiesModule)
  },
  {
    path: AppRoutes.athleteSettings,
    canActivate: [WebappAuthGuard],
    loadChildren: () =>
      import("../../../athlete-settings/athlete-settings.module").then(module => module.AthleteSettingsModule)
  },
  {
    path: AppRoutes.activity,
    canActivate: [WebappAuthGuard],
    loadChildren: () =>
      import("../../../webapp/activity-view/webapp-activity-view.module").then(
        module => module.WebappActivityViewModule
      )
  },
  {
    path: AppRoutes.connectors,
    canActivate: [WebappAuthGuard],
    component: WebappConnectorsComponent
  },
  {
    path: "",
    redirectTo: AppRoutes.activities,
    pathMatch: "full"
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false })],
  exports: [RouterModule]
})
export class WebappRoutingModule {}
