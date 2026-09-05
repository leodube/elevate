import { Gender } from "@elevate/shared/models/athlete/gender.enum";
import { PracticeLevel } from "@elevate/shared/models/athlete/athlete-level.enum";
import { Router } from "express";
import { AthleteModelInput, AthleteRepository, DatedAthleteSettingsInput } from "../repositories/athlete.repository";
import { IntervalsSettingsRepository } from "../repositories/intervals-settings.repository";

export const settingsRouter = Router();
const settingsRepo = new IntervalsSettingsRepository();
const athleteRepo = new AthleteRepository();

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

// --- Athlete model (matches AthleteService.fetch()/update()'s whole-model
// contract exactly - the reused desktop UI always sends/expects the full
// AthleteModel, not per-field or per-entry granular updates) ---

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
