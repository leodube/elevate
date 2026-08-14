import "reflect-metadata";
import cookieParser from "cookie-parser";
import express from "express";
import { env } from "./config/env";
import { intervalsConnector } from "./routes/sync.routes";
import { runMigrations } from "./db/migrate";
import { requireAuth } from "./middleware/auth.middleware";
import { activitiesRouter } from "./routes/activities.routes";
import { authRouter } from "./routes/auth.routes";
import { settingsRouter } from "./routes/settings.routes";
import { syncRouter } from "./routes/sync.routes";

const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000; // ~2 hours, per the agreed sync strategy

const app = express();

app.use(express.json());
app.use(cookieParser());

// Unauthenticated
app.use("/api/auth", authRouter);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Everything else under /api requires the auth cookie
app.use("/api/sync", requireAuth, syncRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/activities", requireAuth, activitiesRouter);

async function start(): Promise<void> {
  // Run automatically on boot so deployment is just "start the container" -
  // no separate migration step to remember. Fails fast and loudly if the
  // schema can't be brought up to date, rather than serving against a
  // broken/partial schema.
  try {
    await runMigrations();
  } catch (err) {
    console.error("Failed to run migrations, refusing to start:", err);
    process.exit(1);
  }

  // Coarse background sync - the "safety net" leg of the three-trigger
  // design (on load / background timer / manual button). isSyncing on the
  // shared connector instance means this can never overlap with a
  // load-triggered or manual sync.
  setInterval(() => {
    if (intervalsConnector.isSyncing) {
      return;
    }
    intervalsConnector.syncNew().catch((err) => {
      console.error("Background sync failed:", err);
    });
  }, BACKGROUND_SYNC_INTERVAL_MS);

  app.listen(env.port, () => {
    console.log(`Elevate webapp server listening on port ${env.port}`);
  });
}

start();
