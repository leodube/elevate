import { Inject, Injectable } from "@angular/core";
import { UserSettingsDao } from "../../../dao/user-settings/user-settings.dao";
import { LoggerService } from "../../logging/logger.service";
import { UserSettingsService } from "../user-settings.service";

/**
 * v1 GAP: same as WebappAthleteService - operates against the local no-op
 * WebappDataStore rather than a server-backed settings store. User-level
 * display preferences (units, zone display, etc.) aren't in webapp v1's
 * scope and will reset per browser/session until this is wired up.
 */
@Injectable()
export class WebappUserSettingsService extends UserSettingsService {
  constructor(
    @Inject(UserSettingsDao) public readonly userSettingsDao: UserSettingsDao,
    @Inject(LoggerService) public readonly logger: LoggerService
  ) {
    super(userSettingsDao, logger);
  }
}
