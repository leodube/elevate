import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { UserSettingsDao } from "../../../dao/user-settings/user-settings.dao";
import { LoggerService } from "../../logging/logger.service";
import { UserSettingsService } from "../user-settings.service";
import { UserSettings } from "@elevate/shared/models/user-settings/user-settings.namespace";
import { BuildTarget } from "@elevate/shared/enums/build-target.enum";
import { ZoneDefinitionModel } from "../../../models/zone-definition.model";
import { ZoneModel } from "@elevate/shared/models/zone.model";
import { UserZonesModel } from "@elevate/shared/models/user-settings/user-zones.model";
import { environment } from "../../../../../environments/environment";

/**
 * fetch() merges a fixed default (UserSettings.getDefaultsByBuildTarget(),
 * tagged buildTarget: WEBAPP) for everything in BaseUserSettings EXCEPT
 * zones and the 4 options GlobalSettingsService exposes for webapp
 * (systemUnit, temperatureUnit, disableMissingStressScoresWarning,
 * disableActivitiesNeedRecalculationWarning) - those come from
 * webapp/server's /api/settings/zones and /api/settings/options, real
 * persisted state rather than defaults. Scoped to exactly those because
 * that's all the pages that read/write settings so far actually touch -
 * ZonesService only calls fetch()/updateZones(), GlobalSettingsComponent
 * only calls fetch()/updateOption() with one of those 4 keys (every other
 * section in GlobalSettingsService.sections is tagged DESKTOP/EXTENSION-
 * only and never reaches a webapp instance of this component).
 *
 * updateZones()/updateOption() are HTTP-backed at the same granularity
 * their callers already use (updateZones(): one zone type per save;
 * updateOption(): one key per save), so nothing in ZonesService/
 * GlobalSettingsComponent needed to change. updateOption() re-fetches
 * afterward rather than merging locally - one extra GET is cheap for
 * something users change rarely, and it keeps fetch() as the single
 * source of truth for assembling the full BaseUserSettings shape instead
 * of duplicating that merge logic here too.
 *
 * resetGlobalSettings()/resetZonesSettings() are still NOT overridden -
 * they call userSettingsDao methods directly rather than going through
 * fetch()/updateOption()/updateZones(), so they still operate against the
 * empty local WebappDataStore. Not exercised: neither
 * GlobalSettingsComponent nor ZonesService ever calls them (both only use
 * the per-key/per-zone-type update paths above).
 */
@Injectable()
export class WebappUserSettingsService extends UserSettingsService {
  constructor(
    @Inject(UserSettingsDao) public readonly userSettingsDao: UserSettingsDao,
    @Inject(LoggerService) public readonly logger: LoggerService,
    @Inject(HttpClient) private readonly httpClient: HttpClient
  ) {
    super(userSettingsDao, logger);
  }

  public fetch(): Promise<UserSettings.BaseUserSettings> {
    const defaults = UserSettings.getDefaultsByBuildTarget(BuildTarget.WEBAPP);
    const zonesUrl = `${environment.backendBaseUrl}/api/settings/zones`;
    const optionsUrl = `${environment.backendBaseUrl}/api/settings/options`;
    return Promise.all([
      firstValueFrom(this.httpClient.get<any>(zonesUrl, { withCredentials: true })),
      firstValueFrom(this.httpClient.get<any>(optionsUrl, { withCredentials: true }))
    ]).then(([rawZones, rawOptions]) => {
      defaults.zones = toUserZonesModel(rawZones);
      defaults.systemUnit = rawOptions.systemUnit;
      defaults.temperatureUnit = rawOptions.temperatureUnit;
      defaults.disableMissingStressScoresWarning = rawOptions.disableMissingStressScoresWarning;
      defaults.disableActivitiesNeedRecalculationWarning = rawOptions.disableActivitiesNeedRecalculationWarning;
      return defaults;
    });
  }

  public updateZones(zoneDefinition: ZoneDefinitionModel, zones: ZoneModel[]): Promise<ZoneModel[]> {
    const values = UserZonesModel.serialize(zones);
    const url = `${environment.backendBaseUrl}/api/settings/zones/${zoneDefinition.value}`;
    return firstValueFrom(this.httpClient.put<any>(url, { values }, { withCredentials: true })).then(raw =>
      UserZonesModel.deserialize(toUserZonesModel(raw)[zoneDefinition.value])
    );
  }

  public updateOption<T extends UserSettings.BaseUserSettings>(
    optionKey: keyof T,
    optionValue: any
  ): Promise<UserSettings.BaseUserSettings> {
    const url = `${environment.backendBaseUrl}/api/settings/options/${String(optionKey)}`;
    return firstValueFrom(this.httpClient.put<any>(url, { value: optionValue }, { withCredentials: true })).then(() =>
      this.fetch()
    );
  }
}

function toUserZonesModel(raw: any): UserZonesModel {
  return new UserZonesModel(
    raw.speed,
    raw.pace,
    raw.heartRate,
    raw.power,
    raw.runningPower,
    raw.cyclingCadence,
    raw.runningCadence,
    raw.grade,
    raw.elevation,
    raw.ascent
  );
}
