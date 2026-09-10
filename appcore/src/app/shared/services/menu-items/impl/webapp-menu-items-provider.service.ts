import { Injectable } from "@angular/core";
import { MenuItemModel, MenuItemsProvider } from "../menu-items-provider.interface";
import { AppRoutes } from "../../../models/app-routes";

/**
 * v1 scope lists the pages this target actually implements. Athlete
 * Settings was added once WebappAthleteService became real (see its own
 * comment). Other appcore pages (yearProgressions, globalSettings,
 * zonesSettings) still aren't wired to real webapp data - leaving them out of
 * the menu avoids surfacing pages that would silently show empty/stale local data.
 */
@Injectable()
export class WebappMenuItemsProvider implements MenuItemsProvider {
  public readonly mainMenuItems: MenuItemModel[] = [
    {
      icon: "view_list",
      routerLink: AppRoutes.activities,
      routerLinkActive: true
    },
    {
      icon: "person",
      routerLink: AppRoutes.athleteSettings,
      routerLinkActive: true
    },
    {
      icon: "timeline",
      routerLink: AppRoutes.fitnessTrend,
      routerLinkActive: true
    },
    {
      icon: "sync",
      routerLink: AppRoutes.connectors,
      routerLinkActive: true
    }
  ];

  public getMenuItems(): MenuItemModel[] {
    return this.mainMenuItems;
  }
}
