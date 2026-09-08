import { Inject, Injectable } from "@angular/core";
import { UserSettingsDao } from "../../../dao/user-settings/user-settings.dao";
import { LoggerService } from "../../logging/logger.service";
import { UserSettingsService } from "../user-settings.service";
import { UserSettings } from "@elevate/shared/models/user-settings/user-settings.namespace";

/**
 * fetch() returns a fixed default (DesktopUserSettings.DEFAULT_MODEL,
 * cloned) rather than something persisted server-side. This is a
 * deliberate scoping choice, not an oversight: the webapp menu has no
 * Global Settings or Zone Settings page yet (out of v1 scope), so there's
 * currently no UI anywhere that could change these values - building
 * real backend persistence for settings nothing can edit yet would be
 * wasted schema/endpoint work. This unblocks the activity view (which
 * reads units/zones for display) without that cost.
 *
 * updateOption()/updateZones()/resetGlobalSettings()/resetZonesSettings()
 * are NOT overridden - they call userSettingsDao methods directly rather
 * than going through fetch(), so they still operate against the empty
 * local WebappDataStore. Not exercised without a settings page to call
 * them from. Revisit fetch() (and add real persistence for the write
 * methods) together, when/if a Global/Zone Settings page gets built.
 */
@Injectable()
export class WebappUserSettingsService extends UserSettingsService {
  constructor(
    @Inject(UserSettingsDao) public readonly userSettingsDao: UserSettingsDao,
    @Inject(LoggerService) public readonly logger: LoggerService
  ) {
    super(userSettingsDao, logger);
  }

  public fetch(): Promise<UserSettings.BaseUserSettings> {
    return Promise.resolve(structuredClone(UserSettings.DesktopUserSettings.DEFAULT_MODEL));
  }
}
