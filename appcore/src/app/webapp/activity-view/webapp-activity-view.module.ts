import { NgModule } from "@angular/core";
import PlotlyJS from "plotly.js-basic-dist-min";
import { PlotlyModule } from "angular-plotly.js";
import { RouterModule, Routes } from "@angular/router";
import { CoreModule } from "../../core/core.module";
import { WebappActivityViewComponent } from "./webapp-activity-view.component";

// Reused directly from desktop/activity-view - confirmed to depend only
// on module-local services (ActivityStatsService, ActivitySensorsService,
// TimeInZonesService, ActivityViewService) or already-real abstract
// tokens (AppService), not concrete Desktop* types. See the phase 1
// investigation notes for the full reasoning per component.
import { ActivityGraphChartComponent } from "../../desktop/activity-view/activity-view-graph/activity-graph-chart.component";
import { ActivityViewTimeInZonesComponent } from "../../desktop/activity-view/activity-view-time-in-zones/activity-view-time-in-zones.component";
import { ActivityViewPeaksComponent } from "../../desktop/activity-view/activity-view-peaks/activity-view-peaks.component";
import { ActivityViewIntervalsComponent } from "../../desktop/activity-view/activity-view-intervals/activity-view-intervals.component";
import { ActivityViewBestSplitsComponent } from "../../desktop/activity-view/activity-view-best-splits/activity-view-best-splits.component";
import { TimeInZonesChartComponent } from "../../desktop/activity-view/activity-view-time-in-zones/time-in-zones-chart/time-in-zones-chart.component";
import { PeakChartComponent } from "../../desktop/activity-view/activity-view-peaks/peak-chart/peak-chart.component";
import { TimeInZonesService } from "../../desktop/activity-view/activity-view-time-in-zones/services/time-in-zones.service";
import { ActivityViewService } from "../../desktop/activity-view/shared/activity-view.service";
import { ActivityViewSummaryStatsComponent } from "../../desktop/activity-view/activity-view-summary-stats/activity-view-summary-stats.component";
import { ActivityViewStatsComponent } from "../../desktop/activity-view/activity-view-stats/activity-view-stats.component";
import { ActivityStatsService } from "../../desktop/activity-view/shared/activity-stats.service";
import { ActivitySensorsService } from "../../desktop/activity-view/shared/activity-sensors.service";
import { ActivityViewMapComponent } from "../../desktop/activity-view/activity-view-map/activity-view-map.component";
import { MapTokenService } from "../../desktop/mapbox/map-token.service";
import { WebappMapTokenService } from "../mapbox/webapp-map-token.service";

PlotlyModule.plotlyjs = PlotlyJS;

const routes: Routes = [
  {
    path: ":id",
    component: WebappActivityViewComponent
  }
];

@NgModule({
  imports: [CoreModule, PlotlyModule, RouterModule.forChild(routes)],
  declarations: [
    WebappActivityViewComponent,
    ActivityViewMapComponent,
    ActivityGraphChartComponent,
    ActivityViewTimeInZonesComponent,
    ActivityViewPeaksComponent,
    ActivityViewIntervalsComponent,
    ActivityViewBestSplitsComponent,
    TimeInZonesChartComponent,
    PeakChartComponent,
    ActivityViewSummaryStatsComponent,
    ActivityViewStatsComponent
  ],
  providers: [
    ActivityViewService,
    ActivitySensorsService,
    ActivityStatsService,
    TimeInZonesService,
    // MapTokenService is desktop's concrete class - overriding it here by
    // the same class reference works regardless of which folder it's
    // defined in, since Angular DI resolves by token identity, not import
    // path. ActivityViewMapComponent's own @Inject(MapTokenService) call
    // needs no changes.
    { provide: MapTokenService, useClass: WebappMapTokenService }
  ]
})
export class WebappActivityViewModule {}
