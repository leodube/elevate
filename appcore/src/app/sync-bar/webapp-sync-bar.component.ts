import { Component, HostBinding, Inject, OnInit } from "@angular/core";
import { SyncBarComponent } from "./sync-bar.component";
import { SyncService } from "../shared/services/sync/sync.service";
import { WebappSyncService } from "../shared/services/sync/impl/webapp-sync.service";

@Component({
  selector: "app-webapp-sync-bar",
  template: `
    <div class="app-sync-bar">
      <div fxLayout="row" fxLayoutAlign="space-between center" class="ribbon">
        <div fxLayout="column" fxLayoutAlign="center start">
          <span fxFlex class="mat-body-1"> Sync triggered - new activities will appear shortly. </span>
        </div>
        <div fxLayout="row" fxLayoutAlign="space-between center">
          <button mat-icon-button (click)="onActionClose()">
            <mat-icon fontSet="material-icons-outlined">close</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .ribbon {
        padding: 10px 20px;
      }
    `
  ]
})
export class WebappSyncBarComponent extends SyncBarComponent implements OnInit {
  @HostBinding("hidden")
  public hiddenSyncBar: boolean;

  constructor(@Inject(SyncService) private readonly webappSyncService: WebappSyncService) {
    super();
    this.hiddenSyncBar = true;
  }

  public ngOnInit(): void {
    // isSyncing$ here reflects "a trigger was just sent" (see
    // WebappSyncService.sync()), not the server-side sync's actual
    // completion - the real sync runs in the background on webapp/server.
    this.webappSyncService.isSyncing$.subscribe(isSyncing => {
      this.hiddenSyncBar = !isSyncing;
    });
  }

  public onActionClose(): void {
    this.hiddenSyncBar = true;
  }
}
