import { Router } from "express";
import { ActivitiesRepository } from "../repositories/activities.repository";
import { AthleteRepository } from "../repositories/athlete.repository";
import { RecalculationService } from "../services/recalculation.service";

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

activitiesRouter.get("/:id", async (req, res) => {
  const activity = await activitiesRepo.getById(req.params.id);
  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json(activity);
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
  // Deliberately not JSON-wrapped further - just the deflated payload the
  // client feeds straight into Streams.inflate().
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

  // Not awaited on purpose, matching the sync trigger pattern - the
  // caller polls /recalculate/status instead of holding the request open.
  recalculationService.recalculate(activityIds).catch(err => {
    console.error("Background recalculation failed:", err);
  });
  res.status(202).json({ ok: true });
});

activitiesRouter.get("/recalculate/status", (_req, res) => {
  res.json(recalculationService.getProgress());
});
