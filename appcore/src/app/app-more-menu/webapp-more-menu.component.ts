import { Component, Inject } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { OPEN_RESOURCE_RESOLVER, OpenResourceResolver } from "../shared/services/links-opener/open-resource-resolver";
import { AppMoreMenuComponent } from "./app-more-menu.component";
import { WebappAuthService } from "../webapp/auth/webapp-auth.service";

@Component({
  selector: "app-webapp-app-more-menu",
  template: `
    <button mat-icon-button [matMenuTriggerFor]="moreMenu">
      <mat-icon fontSet="material-icons-outlined">more_vert</mat-icon>
    </button>
    <mat-menu #moreMenu="matMenu">
      <button mat-menu-item (click)="onOnlineDoc()">
        <mat-icon fontSet="material-icons-outlined">assistant_photo</mat-icon>
        Online Doc
      </button>

      <button mat-menu-item (click)="onShowAbout()">
        <mat-icon fontSet="material-icons-outlined">info</mat-icon>
        About
      </button>

      <button mat-menu-item (click)="onLogout()">
        <mat-icon fontSet="material-icons-outlined">logout</mat-icon>
        Log out
      </button>
    </mat-menu>
  `
})
export class WebappAppMoreMenuComponent extends AppMoreMenuComponent {
  constructor(
    @Inject(Router) protected readonly router: Router,
    @Inject(MatDialog) protected readonly dialog: MatDialog,
    @Inject(OPEN_RESOURCE_RESOLVER) protected readonly openResourceResolver: OpenResourceResolver,
    @Inject(WebappAuthService) private readonly authService: WebappAuthService
  ) {
    super(router, dialog, openResourceResolver);
  }

  public onLogout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(["/login"]);
    });
  }
}
