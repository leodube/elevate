import fs from "fs";
import path from "path";
import { pool } from "./pool";

// Configurable so the runtime image can point this at a stable location
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(__dirname, "migrations");

/**
 * Applies any .sql files in ./migrations that haven't been run yet, in
 * filename order (hence the 0001_, 0002_... prefix convention). Tracks
 * what's been applied in a schema_migrations table.
 *
 * Deliberately not using a migration library - for a single-user app with
 * a handful of tables, plain numbered SQL files plus this runner is enough
 * and keeps the dependency list small.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set((await client.query("SELECT filename FROM schema_migrations")).rows.map(r => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`Applying migration: ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
}

// Allow running directly: npx tsx src/db/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Migrations up to date");
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
