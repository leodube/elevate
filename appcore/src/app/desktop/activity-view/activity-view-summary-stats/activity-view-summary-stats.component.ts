import { Component, Inject, Input, OnChanges, SimpleChanges } from "@angular/core";
import { ActivityStatsService } from "../shared/activity-stats.service";
import { StatDisplay } from "../shared/models/stats/display/stat-display.model";
import { MediaObserver } from "@angular/flex-layout";
import { ActivityViewMapComponent } from "../activity-view-map/activity-view-map.component";
import { SummaryStatsGroup } from "../shared/models/stats/summary-stat-group.model";
import { MeasureSystem } from "@elevate/shared/enums/measure-system.enum";
import { Activity } from "@elevate/shared/models/sync/activity.model";

@Component({
  selector: "app-activity-view-summary-stats",
  templateUrl: "./activity-view-summary-stats.component.html",
  styleUrls: ["./activity-view-summary-stats.component.scss"]
})
export class ActivityViewSummaryStatsComponent implements OnChanges {
  public summaryStatDisplays: StatDisplay[];

  public columnsCount: number;
  public rowCount: number;
  public rowHeight: number;

  @Input()
  public activity: Activity;

  @Input()
  public measureSystem: MeasureSystem;

  @Input()
  public hasMapData: boolean;

  constructor(
    @Inject(ActivityStatsService) protected readonly statsService: ActivityStatsService,
    @Inject(MediaObserver) public readonly mediaObserver: MediaObserver
  ) {}

  /**
   * Was ngOnInit() only - correct as long as hasMapData is already final
   * by the time this component initializes. webapp's parent component
   * sets hasMapData asynchronously, two promise steps after the card
   * (and this component) already start rendering off *ngIf="activity" -
   * so ngOnInit() saw hasMapData at its default value and computed the
   * "no map" 9-column layout permanently, never recomputing once the
   * real value arrived. ngOnChanges() fires on every input change
   * (including the first, so this still initializes correctly on a
   * synchronous consumer like desktop) - the fix that actually matters
   * for webapp is that it ALSO re-fires when hasMapData updates later.
   */
  public ngOnChanges(changes: SimpleChanges): void {
    this.columnsCount = this.hasMapData
      ? SummaryStatsGroup.DEFAULT_COLUMNS_COUNT
      : SummaryStatsGroup.DEFAULT_COLUMNS_COUNT * SummaryStatsGroup.DEFAULT_ROW_COUNT;

    this.rowCount = SummaryStatsGroup.DEFAULT_ROW_COUNT;

    this.rowHeight = ActivityViewMapComponent.MAP_HEIGHT_PX / SummaryStatsGroup.DEFAULT_ROW_COUNT;

    if (this.activity) {
      this.summaryStatDisplays = this.statsService.getSummaryStats(this.activity, this.measureSystem);
    }
  }
}
