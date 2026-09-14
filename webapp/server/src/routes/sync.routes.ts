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
    ...connector.getProgress(),
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

const BACKFILL_MIN_DATE = new Date(2000, 0, 1);

syncRouter.post("/backfill", async (req, res) => {
  if (connector.isSyncing) {
    res.status(409).json({ error: "Sync already in progress" });
    return;
  }

  const { oldest: oldestRaw, resyncExisting } = req.body ?? {};

  let oldest: Date | undefined;
  if (oldestRaw !== undefined) {
    if (typeof oldestRaw !== "string") {
      res.status(400).json({ error: "oldest must be an ISO date string" });
      return;
    }
    oldest = new Date(oldestRaw);
    const now = new Date();
    if (Number.isNaN(oldest.getTime()) || oldest < BACKFILL_MIN_DATE || oldest > now) {
      res.status(400).json({ error: "oldest must be between 2000-01-01 and today" });
      return;
    }
  }

  if (resyncExisting !== undefined && typeof resyncExisting !== "boolean") {
    res.status(400).json({ error: "resyncExisting must be a boolean" });
    return;
  }

  try {
    connector.backfill(oldest, undefined, !!resyncExisting).catch(err => {
      console.error("Background backfill failed:", err);
    });
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
