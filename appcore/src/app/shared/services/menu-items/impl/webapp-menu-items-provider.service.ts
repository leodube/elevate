import { Injectable } from "@angular/core";
import { MenuItemModel, MenuItemsProvider } from "../menu-items-provider.interface";
import { AppRoutes } from "../../../models/app-routes";

/**
 * v1 scope only lists the pages this target actually implements. Other
 * appcore pages (fitnessTrend, yearProgressions, globalSettings,
 * athleteSettings, zonesSettings) exist in the shared UI but aren't
 * wired to real webapp data yet (see the v1 gaps noted in
 * WebappAthleteService/WebappUserSettingsService) - leaving them out of
 * the menu avoids surfacing pages that would silently show empty/stale
 * local data.
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
      icon: "sync",
      routerLink: AppRoutes.connectors,
      routerLinkActive: true
    }
  ];

  public getMenuItems(): MenuItemModel[] {
    return this.mainMenuItems;
  }
}
