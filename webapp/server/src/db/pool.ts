import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  host: env.pg.host,
  port: env.pg.port,
  database: env.pg.database,
  user: env.pg.user,
  password: env.pg.password
});

pool.on("error", err => {
  // Idle client errors shouldn't crash the process - log and move on.
  // eslint-disable-next-line no-console
  console.error("Unexpected Postgres pool error", err);
});
