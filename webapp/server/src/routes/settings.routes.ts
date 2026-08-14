import { Gender } from "@elevate/shared/models/athlete/gender.enum";
import { Router } from "express";
import { AthleteRepository, DatedAthleteSettingsInput } from "../repositories/athlete.repository";
import { IntervalsSettingsRepository } from "../repositories/intervals-settings.repository";

export const settingsRouter = Router();
const settingsRepo = new IntervalsSettingsRepository();
const athleteRepo = new AthleteRepository();

settingsRouter.get("/intervals-connector", async (_req, res) => {
  const settings = await settingsRepo.get();
  res.json({
    configured: !!settings?.apiKey,
    athleteId: settings?.athleteId ?? null,
    lastSyncedAt: settings?.lastSyncedAt ?? null,
    // API key itself is never returned to the client once set.
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

// --- Athlete profile (gender, birth date) ---

settingsRouter.put("/athlete-profile", async (req, res) => {
  const { gender, birthDate } = req.body ?? {};
  if (gender !== Gender.MEN && gender !== Gender.WOMEN) {
    res.status(400).json({ error: "gender must be 'men' or 'women'" });
    return;
  }
  await athleteRepo.updateProfile(gender, typeof birthDate === "string" ? birthDate : null);
  res.status(200).json({ ok: true });
});

// --- Dated athlete settings (FTP/weight/HR, over time) ---

settingsRouter.get("/athlete-settings", async (_req, res) => {
  const entries = await athleteRepo.listDatedSettings();
  res.json({ entries });
});

settingsRouter.post("/athlete-settings", async (req, res) => {
  const body = req.body ?? {};
  const entry: DatedAthleteSettingsInput = {
    since: typeof body.since === "string" ? body.since : null,
    maxHr: numOrNull(body.maxHr),
    restHr: numOrNull(body.restHr),
    lthrDefault: numOrNull(body.lthrDefault),
    lthrCycling: numOrNull(body.lthrCycling),
    lthrRunning: numOrNull(body.lthrRunning),
    cyclingFtp: numOrNull(body.cyclingFtp),
    runningFtp: numOrNull(body.runningFtp),
    swimFtp: numOrNull(body.swimFtp),
    weight: numOrNull(body.weight),
  };
  await athleteRepo.addDatedSettings(entry);
  res.status(201).json({ ok: true });
});

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}
