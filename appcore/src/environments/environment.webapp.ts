// Webapp target environment. Deliberately reuses BuildTarget.DESKTOP rather
// than introducing a new enum value - adding a genuine BuildTarget.WEBAPP
// would require new cases in several exhaustive switches elsewhere in the
// shared codebase (UserSettings.getDefaultsByBuildTarget, GlobalSettingsService's
// per-target settings list, activity column definitions) that aren't part of
// webapp v1's scope. Presenting as DESKTOP also keeps the frontend consistent
// with webapp/server, which already computes activities against
// BuildTarget.DESKTOP's settings shape (see intervals.connector.ts).

import { LoggerService } from "../app/shared/services/logging/logger.service";
import { BuildTarget } from "@elevate/shared/enums/build-target.enum";

export const environment = {
  buildTarget: BuildTarget.DESKTOP,
  production: false,
  logLevel: LoggerService.LEVEL_DEBUG,
  minBackupVersion: "7.0.0-0",
  showDebugRibbon: false,
  showActivityDebugData: false,
  showRouteUrl: false,
  bypassProfileRestoreChecks: false,
  // webapp/server's base URL
  backendBaseUrl: "http://localhost:3000"
};
