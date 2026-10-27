import { Router } from "express";
import { YearProgressPresetInput, YearProgressPresetsRepository } from "../repositories/year-progress-presets.repository";

export const yearProgressRouter = Router();
const presetsRepo = new YearProgressPresetsRepository();

const MODES = ["YEAR_TO_DATE", "ROLLING"];
const PROGRESS_TYPES = ["DISTANCE", "TIME", "ELEVATION", "COUNT"];

yearProgressRouter.get("/presets", async (_req, res) => {
  const presets = await presetsRepo.list();
  res.json(presets);
});

yearProgressRouter.post("/presets", async (req, res) => {
  const body = req.body ?? {};

  if (typeof body.id !== "string" || body.id.length === 0) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  if (!MODES.includes(body.mode)) {
    res.status(400).json({ error: `mode must be one of: ${MODES.join(", ")}` });
    return;
  }
  if (!PROGRESS_TYPES.includes(body.progressType)) {
    res.status(400).json({ error: `progressType must be one of: ${PROGRESS_TYPES.join(", ")}` });
    return;
  }
  if (!Array.isArray(body.activityTypes) || body.activityTypes.some((t: unknown) => typeof t !== "string")) {
    res.status(400).json({ error: "activityTypes must be an array of strings" });
    return;
  }

  const input: YearProgressPresetInput = {
    id: body.id,
    mode: body.mode,
    progressType: body.progressType,
    activityTypes: body.activityTypes,
    includeCommuteRide: !!body.includeCommuteRide,
    includeIndoorRide: !!body.includeIndoorRide,
    targetValue: numOrNull(body.targetValue),
    rollingPeriod: typeof body.rollingPeriod === "string" ? body.rollingPeriod : null,
    periodMultiplier: numOrNull(body.periodMultiplier)
  };

  const created = await presetsRepo.insert(input);
  res.status(201).json(created);
});

yearProgressRouter.delete("/presets/:id", async (req, res) => {
  await presetsRepo.removeById(req.params.id);
  res.status(200).json({ ok: true });
});

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}
