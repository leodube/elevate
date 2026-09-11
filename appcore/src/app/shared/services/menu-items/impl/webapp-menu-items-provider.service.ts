import { Injectable } from "@angular/core";
import { MenuItemModel, MenuItemsProvider } from "../menu-items-provider.interface";
import { AppRoutes } from "../../../models/app-routes";

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
      icon: "date_range",
      routerLink: AppRoutes.yearProgressions,
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
