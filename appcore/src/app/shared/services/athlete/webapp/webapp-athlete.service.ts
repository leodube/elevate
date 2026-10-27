import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { AthleteDao } from "../../../dao/athlete/athlete.dao";
import { AthleteService } from "../athlete.service";
import { AthleteModel } from "@elevate/shared/models/athlete/athlete.model";
import { AthleteSettings } from "@elevate/shared/models/athlete/athlete-settings/athlete-settings.model";
import { DatedAthleteSettings } from "@elevate/shared/models/athlete/athlete-settings/dated-athlete-settings.model";
import { environment } from "../../../../../environments/environment";

/**
 * HTTP-backed against webapp/server's /api/settings/athlete-model.
 *
 * Only fetch()/update() are overridden - AthleteService's base class
 * already implements addSettings()/editSettings()/removeSettings()/
 * validate() entirely in terms of those two primitives (in-memory array
 * mutation on a fetched AthleteModel, then one whole-model update() call).
 * That's the same contract the desktop DAO satisfies, so the entire
 * AthleteSettingsModule UI (form, dated-settings manager, edit dialog)
 * works unmodified once these two methods are real - no need to
 * reimplement any of that logic here.
 *
 * insert()/clear() are NOT overridden - neither is called anywhere in the
 * AthleteSettingsModule UI (clear() is only used by extension's
 * backup/restore flow, which webapp doesn't have).
 */
@Injectable()
export class WebappAthleteService extends AthleteService {
  constructor(
    @Inject(AthleteDao) public readonly athleteModelDao: AthleteDao,
    @Inject(HttpClient) private readonly httpClient: HttpClient
  ) {
    super(athleteModelDao);
  }

  public fetch(): Promise<AthleteModel> {
    const url = `${environment.backendBaseUrl}/api/settings/athlete-model`;
    return firstValueFrom(this.httpClient.get<any>(url, { withCredentials: true })).then(raw =>
      this.toAthleteModelInstance(raw)
    );
  }

  public update(athleteModel: AthleteModel): Promise<AthleteModel> {
    const url = `${environment.backendBaseUrl}/api/settings/athlete-model`;
    return firstValueFrom(this.httpClient.put<any>(url, athleteModel, { withCredentials: true })).then(raw =>
      this.toAthleteModelInstance(raw)
    );
  }

  /**
   * The server returns plain JSON - reconstructs real class instances
   * (with working isForever()/toAthleteSettingsModel() etc, and birthDate
   * as an actual Date rather than a string) since the reused UI calls
   * those methods and binds birthDate straight into a mat-datepicker.
   */
  private toAthleteModelInstance(raw: any): AthleteModel {
    const datedAthleteSettings = (raw.datedAthleteSettings ?? []).map((entry: any) => {
      const settings = new AthleteSettings(
        entry.maxHr,
        entry.restHr,
        entry.lthr,
        entry.cyclingFtp,
        entry.runningFtp,
        entry.swimFtp,
        entry.weight
      );
      return new DatedAthleteSettings(entry.since, settings);
    });

    return new AthleteModel(
      raw.gender,
      datedAthleteSettings,
      raw.firstName ?? null,
      raw.lastName ?? null,
      raw.birthDate ? new Date(raw.birthDate) : null,
      raw.practiceLevel ?? null,
      raw.sports ?? []
    );
  }
}
