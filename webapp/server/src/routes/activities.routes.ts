import { Router } from "express";
import { ActivitiesRepository } from "../repositories/activities.repository";
import { AthleteRepository } from "../repositories/athlete.repository";
import { RecalculationService } from "../services/recalculation.service";
import { SplitCalculatorProcessor } from "../processors/split-calculator/split-calculator.processor";
import { SplitRequest } from "@elevate/shared/models/splits/split-request.model";
import { intervalsConnector } from "./sync.routes";

export const activitiesRouter = Router();
const activitiesRepo = new ActivitiesRepository();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

activitiesRouter.get("/", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(String(req.query.offset ?? 0), 10) || 0, 0);
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const since = typeof req.query.since === "string" ? new Date(req.query.since) : undefined;
  const until = typeof req.query.until === "string" ? new Date(req.query.until) : undefined;

  const { items, total } = await activitiesRepo.list({ type, since, until, limit, offset });
  res.json({ items, total, limit, offset });
});

// Registered before /:id below - otherwise Express's param route would
// match "sports" as an activity id first.
activitiesRouter.get("/sports", async (_req, res) => {
  const summary = await activitiesRepo.getSportsSummary();
  res.json(summary);
});

activitiesRouter.get("/:id", async (req, res) => {
  const activity = await activitiesRepo.getById(req.params.id);
  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json(activity);
});

/**
 * Re-fetches an activity and recomputes it against currently athlete settings
 */
activitiesRouter.post("/:id/resync", async (req, res) => {
  try {
    await intervalsConnector.resyncActivity(req.params.id);
    const updated = await activitiesRepo.getById(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

activitiesRouter.get("/:id/streams", async (req, res) => {
  const exists = await activitiesRepo.exists(req.params.id);
  if (!exists) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  const deflated = await activitiesRepo.getStreamsDeflated(req.params.id);
  if (deflated === null) {
    res.status(404).json({ error: "No streams stored for this activity" });
    return;
  }
  res.json({ deflated });
});

const recalculationService = new RecalculationService(activitiesRepo, new AthleteRepository());

activitiesRouter.post("/recalculate", async (req, res) => {
  const { activityIds } = req.body ?? {};
  if (!Array.isArray(activityIds) || activityIds.some(id => typeof id !== "string")) {
    res.status(400).json({ error: "activityIds must be an array of strings" });
    return;
  }
  if (recalculationService.isRecalculating) {
    res.status(409).json({ error: "Recalculation already in progress" });
    return;
  }

  // Not awaited on purpose, the caller polls /recalculate/status
  recalculationService.recalculate(activityIds).catch(err => {
    console.error("Background recalculation failed:", err);
  });
  res.status(202).json({ ok: true });
});

activitiesRouter.get("/recalculate/status", (_req, res) => {
  res.json(recalculationService.getProgress());
});

const splitCalculator = new SplitCalculatorProcessor();

activitiesRouter.post("/compute-split", async (req, res) => {
  const splitRequest = req.body as SplitRequest;
  if (
    typeof splitRequest?.type !== "number" ||
    typeof splitRequest?.range !== "number" ||
    !Array.isArray(splitRequest?.scaleStream) ||
    !Array.isArray(splitRequest?.dataStreams)
  ) {
    res.status(400).json({ error: "Invalid split request" });
    return;
  }

  try {
    const response = await splitCalculator.computeSplits(splitRequest);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
