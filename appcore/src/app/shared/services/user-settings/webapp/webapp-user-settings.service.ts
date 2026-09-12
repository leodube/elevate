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
 * zones, which now comes from webapp/server's /api/settings/zones -
 * that's real, persisted state, not a default. Scoped to zones
 * specifically because that's the only part of BaseUserSettings the Zone
 * Settings page (the only page reading/writing settings so far) actually
 * touches - see ZonesService, which only ever calls fetch()/updateZones().
 *
 * updateZones() is HTTP-backed the same way, PUT-ing one zone type at a
 * time against /api/settings/zones/:zoneType - matches exactly how the
 * reused Zone Settings UI already calls it (one zone type edited per
 * save), so nothing in ZonesService/ZonesSettingsComponent needed to
 * change.
 *
 * updateOption()/resetGlobalSettings()/resetZonesSettings() are still NOT
 * overridden - they call userSettingsDao methods directly rather than
 * going through fetch()/updateZones(), so they still operate against the
 * empty local WebappDataStore. Not exercised: ZonesService's own
 * "reset to default" (resetZonesToDefault()) goes through updateZones()
 * like every other zone edit, never resetZonesSettings(); and
 * updateOption()/resetGlobalSettings() are Global Settings page territory,
 * which still doesn't exist in the webapp. Revisit together if/when that
 * page gets built.
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
    const url = `${environment.backendBaseUrl}/api/settings/zones`;
    return firstValueFrom(this.httpClient.get<any>(url, { withCredentials: true })).then(raw => {
      defaults.zones = toUserZonesModel(raw);
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
