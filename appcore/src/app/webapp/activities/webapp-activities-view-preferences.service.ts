import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ElevateSport } from "@elevate/shared/enums/elevate-sport.enum";
import { environment } from "../../../environments/environment";

export interface ActivitiesViewPreferences {
  selectedSports: ElevateSport[];
  // null = nothing saved yet - caller should fall back to its own default
  // columns, same meaning ActivitiesComponent.getSelectedColumns() gives
  // a null localStorage read today.
  selectedColumns: string[] | null;
}

/**
 * Webapp-only: persists the activities table's "Filter by sports" and
 * "Columns displayed" selections server-side, so they survive across
 * sessions/devices instead of resetting like localStorage-only state
 * would on a fresh browser/profile. Deliberately NOT a DI swap of some
 * shared abstract service (unlike ActivityService/UserSettingsService
 * etc.) - desktop/extension keep their existing localStorage-only
 * behavior for both of these completely untouched. This service is only
 * ever provided in webapp-target.module.ts, and ActivitiesComponent picks
 * it up via @Optional() injection - see that component for how the two
 * code paths are selected.
 *
 * Sports and columns save independently (two PUT endpoints) rather than
 * one combined save, matching the fact that they're two separate controls
 * with two separate change events on the page - avoids a read-modify-write
 * race if both changed close together.
 */
@Injectable()
export class WebappActivitiesViewPreferencesService {
  constructor(@Inject(HttpClient) private readonly httpClient: HttpClient) {}

  public get(): Promise<ActivitiesViewPreferences> {
    const url = `${environment.backendBaseUrl}/api/settings/activities-view`;
    return firstValueFrom(this.httpClient.get<ActivitiesViewPreferences>(url, { withCredentials: true }));
  }

  public saveSelectedSports(selectedSports: ElevateSport[]): Promise<void> {
    const url = `${environment.backendBaseUrl}/api/settings/activities-view/sports`;
    return firstValueFrom(
      this.httpClient.put<void>(url, { selectedSports }, { withCredentials: true })
    ).then(() => undefined);
  }

  public saveSelectedColumns(selectedColumns: string[]): Promise<void> {
    const url = `${environment.backendBaseUrl}/api/settings/activities-view/columns`;
    return firstValueFrom(
      this.httpClient.put<void>(url, { selectedColumns }, { withCredentials: true })
    ).then(() => undefined);
  }
}
