import { Router } from "express";
import { IntervalsConnector } from "../connectors/intervals.connector";
import { ActivitiesRepository } from "../repositories/activities.repository";
import { AthleteRepository } from "../repositories/athlete.repository";
import { IntervalsSettingsRepository } from "../repositories/intervals-settings.repository";

export const syncRouter = Router();

// Single shared connector instance so isSyncing is a process-wide guard
const connector = new IntervalsConnector(
  new IntervalsSettingsRepository(),
  new ActivitiesRepository(),
  new AthleteRepository()
);

export { connector as intervalsConnector };

syncRouter.get("/status", async (_req, res) => {
  const settingsRepo = new IntervalsSettingsRepository();
  const settings = await settingsRepo.get();
  res.json({
    isSyncing: connector.isSyncing,
    lastSyncedAt: settings?.lastSyncedAt ?? null
  });
});

syncRouter.post("/trigger", async (_req, res) => {
  if (connector.isSyncing) {
    res.status(409).json({ error: "Sync already in progress" });
    return;
  }

  try {
    // Not awaited on purpose - the caller (page load / button) gets an
    // immediate 202 and polls /status, rather than holding the HTTP
    // request open for the duration of a sync.
    connector.syncNew().catch(err => {
      console.error("Background sync failed:", err);
    });
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

syncRouter.post("/backfill", async (_req, res) => {
  if (connector.isSyncing) {
    res.status(409).json({ error: "Sync already in progress" });
    return;
  }

  try {
    connector.backfill().catch(err => {
      console.error("Background backfill failed:", err);
    });
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
