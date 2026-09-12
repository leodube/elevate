import { Gender } from "@elevate/shared/models/athlete/gender.enum";
import { PracticeLevel } from "@elevate/shared/models/athlete/athlete-level.enum";
import { Router } from "express";
import { AthleteModelInput, AthleteRepository, DatedAthleteSettingsInput } from "../repositories/athlete.repository";
import { IntervalsSettingsRepository } from "../repositories/intervals-settings.repository";
import { ActivitiesViewPreferencesRepository } from "../repositories/activities-view-preferences.repository";
import { isKnownZoneType, UserZonesRepository } from "../repositories/user-zones.repository";

export const settingsRouter = Router();
const settingsRepo = new IntervalsSettingsRepository();
const athleteRepo = new AthleteRepository();
const activitiesViewPreferencesRepo = new ActivitiesViewPreferencesRepository();
const userZonesRepo = new UserZonesRepository();

settingsRouter.get("/intervals-connector", async (_req, res) => {
  const settings = await settingsRepo.get();
  res.json({
    configured: !!settings?.apiKey,
    apiKey: settings?.apiKey,
    athleteId: settings?.athleteId ?? null,
    lastSyncedAt: settings?.lastSyncedAt ?? null
  });
});

settingsRouter.put("/intervals-connector", async (req, res) => {
  const { apiKey, athleteId } = req.body ?? {};
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    res.status(400).json({ error: "Missing apiKey" });
    return;
  }
  await settingsRepo.upsertCredentials(apiKey, typeof athleteId === "string" ? athleteId : null);
  res.status(200).json({ ok: true });
});

settingsRouter.get("/athlete-model", async (_req, res) => {
  const athleteModel = await athleteRepo.getAthleteModel();
  res.json(athleteModel);
});

settingsRouter.put("/athlete-model", async (req, res) => {
  const body = req.body ?? {};

  if (body.gender !== Gender.MEN && body.gender !== Gender.WOMEN) {
    res.status(400).json({ error: "gender must be 'men' or 'women'" });
    return;
  }
  if (!Array.isArray(body.datedAthleteSettings)) {
    res.status(400).json({ error: "datedAthleteSettings must be an array" });
    return;
  }

  const input: AthleteModelInput = {
    gender: body.gender,
    firstName: typeof body.firstName === "string" ? body.firstName : null,
    lastName: typeof body.lastName === "string" ? body.lastName : null,
    birthDate: typeof body.birthDate === "string" ? body.birthDate.slice(0, 10) : null,
    practiceLevel: Object.values(PracticeLevel).includes(body.practiceLevel) ? body.practiceLevel : null,
    sports: Array.isArray(body.sports) ? body.sports : [],
    datedAthleteSettings: body.datedAthleteSettings.map(
      (entry: any): DatedAthleteSettingsInput => ({
        since: typeof entry.since === "string" ? entry.since : null,
        maxHr: numOrNull(entry.maxHr),
        restHr: numOrNull(entry.restHr),
        lthrDefault: numOrNull(entry.lthr?.default),
        lthrCycling: numOrNull(entry.lthr?.cycling),
        lthrRunning: numOrNull(entry.lthr?.running),
        cyclingFtp: numOrNull(entry.cyclingFtp),
        runningFtp: numOrNull(entry.runningFtp),
        swimFtp: numOrNull(entry.swimFtp),
        weight: numOrNull(entry.weight)
      })
    )
  };

  await athleteRepo.replaceAthleteModel(input);
  const updated = await athleteRepo.getAthleteModel();
  res.json(updated);
});

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

settingsRouter.get("/activities-view", async (_req, res) => {
  const preferences = await activitiesViewPreferencesRepo.get();
  res.json(preferences);
});

settingsRouter.put("/activities-view/sports", async (req, res) => {
  const { selectedSports } = req.body ?? {};
  if (!Array.isArray(selectedSports) || selectedSports.some((s: unknown) => typeof s !== "string")) {
    res.status(400).json({ error: "selectedSports must be an array of strings" });
    return;
  }
  await activitiesViewPreferencesRepo.updateSelectedSports(selectedSports);
  res.status(200).json({ ok: true });
});

settingsRouter.put("/activities-view/columns", async (req, res) => {
  const { selectedColumns } = req.body ?? {};
  if (!Array.isArray(selectedColumns) || selectedColumns.some((c: unknown) => typeof c !== "string")) {
    res.status(400).json({ error: "selectedColumns must be an array of strings" });
    return;
  }
  await activitiesViewPreferencesRepo.updateSelectedColumns(selectedColumns);
  res.status(200).json({ ok: true });
});

settingsRouter.get("/zones", async (_req, res) => {
  const zones = await userZonesRepo.get();
  res.json(zones);
});

settingsRouter.put("/zones/:zoneType", async (req, res) => {
  const { zoneType } = req.params;
  if (!isKnownZoneType(zoneType)) {
    res.status(400).json({ error: `Unknown zone type: ${zoneType}` });
    return;
  }

  const { values } = req.body ?? {};
  if (!Array.isArray(values) || values.some((v: unknown) => typeof v !== "number" || Number.isNaN(v))) {
    res.status(400).json({ error: "values must be an array of numbers" });
    return;
  }

  const updated = await userZonesRepo.updateZoneType(zoneType, values);
  res.json(updated);
});
