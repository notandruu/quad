import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

let pool: Pool | null = null;
let migrated = false;

/**
 * Lazily create a Postgres pool and run the schema migration on first use.
 * Returns null when DATABASE_URL is unset so every caller degrades to the
 * in-memory seed store without crashing.
 */
export function getPool(): Pool | null {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  return pool;
}

export function isBrainConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Run schema.sql against the connected database exactly once per process.
 * Safe to call multiple times — the SQL uses IF NOT EXISTS everywhere.
 * Call this at startup (e.g. from the ingest route) rather than on every
 * query to keep request latency predictable.
 */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  const db = getPool();
  if (!db) return;

  const schemaPath = join(process.cwd(), "src/lib/brain/schema.sql");
  let sql: string;
  try {
    sql = readFileSync(schemaPath, "utf-8");
  } catch {
    // Schema file missing in edge deployments; skip silently.
    return;
  }

  await db.query(sql);
  migrated = true;
}

/**
 * Ping the database and return latency in ms. Used by /api/settings and
 * the debug drawer to prove the brain is live.
 */
export async function pingBrain(): Promise<{ ok: boolean; latencyMs?: number }> {
  const db = getPool();
  if (!db) return { ok: false };
  const start = Date.now();
  try {
    await db.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false };
  }
}
