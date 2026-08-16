import { Inject, Injectable } from "@angular/core";
import { AthleteDao } from "../../../dao/athlete/athlete.dao";
import { AthleteService } from "../athlete.service";

/**
 * v1 GAP: operates against the local no-op WebappDataStore, NOT against
 * webapp/server's /api/settings/athlete-profile and /api/settings/athlete-settings
 * endpoints built in the connector work. Athlete-settings management wasn't
 * in webapp v1's agreed scope (login + activities list + connectors page).
 *
 * Practical effect: fetch() will return empty/undefined rather than the
 * real dated FTP/weight/HR settings, so anything relying on this service
 * (e.g. ActivityService.isAthleteSettingsConsistent()) will not reflect
 * real athlete data yet. Activities themselves are unaffected - they
 * arrive already computed from the server, which resolves athlete
 * settings correctly on its own (see AthleteRepository in webapp/server).
 */
@Injectable()
export class WebappAthleteService extends AthleteService {
  constructor(@Inject(AthleteDao) public readonly athleteModelDao: AthleteDao) {
    super(athleteModelDao);
  }
}
