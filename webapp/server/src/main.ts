import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import pinoHttp from "pino-http";
import "reflect-metadata";
import { env } from "./config/env";
import { runMigrations } from "./db/migrate";
import { requireAuth } from "./middleware/auth.middleware";
import { activitiesRouter } from "./routes/activities.routes";
import { authRouter } from "./routes/auth.routes";
import { settingsRouter } from "./routes/settings.routes";
import { intervalsConnector, syncRouter } from "./routes/sync.routes";
import { yearProgressRouter } from "./routes/year-progress.routes";
import { logger } from "./tools/logger";

const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();

app.use(pinoHttp({ logger }));

app.use(express.json());
app.use(cookieParser());

// Unauthenticated
app.use("/api/auth", authRouter);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Authenticated
app.use("/api/sync", requireAuth, syncRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/activities", requireAuth, activitiesRouter);
app.use("/api/year-progress", requireAuth, yearProgressRouter);

// Static client + SPA fallback
app.use(express.static(PUBLIC_DIR));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

async function start(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, "Failed to run migrations, refusing to start");
    process.exit(1);
  }

  // Coarse background sync
  setInterval(() => {
    if (intervalsConnector.isSyncing) {
      return;
    }
    intervalsConnector.syncNew().catch(err => {
      logger.error({ err }, "Background sync failed");
    });
  }, BACKGROUND_SYNC_INTERVAL_MS);

  app.listen(env.port, () => {
    logger.info(`Elevate webapp server listening on port ${env.port}`);
  });
}

start();
