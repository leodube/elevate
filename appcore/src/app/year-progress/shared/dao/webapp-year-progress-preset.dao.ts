import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { YearProgressPresetDao } from "./year-progress-preset.dao";
import { YearToDateProgressPresetModel } from "../models/year-to-date-progress-preset.model";
import { RollingProgressPresetModel } from "../models/rolling-progress-preset.model";
import { ProgressMode } from "../enums/progress-mode.enum";
import { ProgressType } from "../enums/progress-type.enum";
import { environment } from "../../../../environments/environment";

interface RawPreset {
  id: string;
  mode: string; // "YEAR_TO_DATE" | "ROLLING"
  progressType: string; // "DISTANCE" | "TIME" | "ELEVATION" | "COUNT"
  activityTypes: string[];
  includeCommuteRide: boolean;
  includeIndoorRide: boolean;
  targetValue: number | null;
  rollingPeriod: string | null;
  periodMultiplier: number | null;
}

/**
 * HTTP-backed against webapp/server's /api/year-progress/presets.
 */
@Injectable()
export class WebappYearProgressPresetDao extends YearProgressPresetDao {
  constructor(@Inject(HttpClient) private readonly httpClient: HttpClient) {
    super(null);
  }

  public find(): Promise<YearToDateProgressPresetModel[]> {
    const url = `${environment.backendBaseUrl}/api/year-progress/presets`;
    return firstValueFrom(this.httpClient.get<RawPreset[]>(url, { withCredentials: true })).then(raw =>
      raw.map(toModel)
    );
  }

  public insert(doc: YearToDateProgressPresetModel): Promise<YearToDateProgressPresetModel> {
    const url = `${environment.backendBaseUrl}/api/year-progress/presets`;
    return firstValueFrom(this.httpClient.post<RawPreset>(url, toRawPreset(doc), { withCredentials: true })).then(
      toModel
    );
  }

  public removeById(id: number | string): Promise<void> {
    const url = `${environment.backendBaseUrl}/api/year-progress/presets/${id}`;
    return firstValueFrom(this.httpClient.delete<void>(url, { withCredentials: true })).then(() => undefined);
  }
}

function toModel(raw: RawPreset): YearToDateProgressPresetModel {
  const progressType: ProgressType = (ProgressType as any)[raw.progressType];
  const activityTypes = raw.activityTypes as any[];

  const model: YearToDateProgressPresetModel =
    raw.mode === "ROLLING"
      ? new RollingProgressPresetModel(
          progressType,
          activityTypes,
          raw.includeCommuteRide,
          raw.includeIndoorRide,
          raw.targetValue,
          raw.rollingPeriod,
          raw.periodMultiplier
        )
      : new YearToDateProgressPresetModel(
          progressType,
          activityTypes,
          raw.includeCommuteRide,
          raw.includeIndoorRide,
          raw.targetValue
        );

  // Constructors generate a fresh id - overwrite with the server's, which
  // is what callers (e.g. removeById() after a delete) key off of
  model.id = raw.id;
  return model;
}

function toRawPreset(doc: YearToDateProgressPresetModel): RawPreset {
  const rolling = doc as RollingProgressPresetModel;
  return {
    id: doc.id,
    mode: ProgressMode[doc.mode],
    progressType: ProgressType[doc.progressType],
    activityTypes: doc.activityTypes as any[],
    includeCommuteRide: doc.includeCommuteRide,
    includeIndoorRide: doc.includeIndoorRide,
    targetValue: doc.targetValue ?? null,
    rollingPeriod: doc.mode === ProgressMode.ROLLING ? rolling.rollingPeriod : null,
    periodMultiplier: doc.mode === ProgressMode.ROLLING ? rolling.periodMultiplier : null
  };
}
