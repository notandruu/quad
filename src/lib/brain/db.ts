import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * Lazily create a Postgres pool. Returns null when DATABASE_URL is unset so
 * the app can run against in-memory seed data during early development.
 */
export function getPool(): Pool | null {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  pool = new Pool({ connectionString, max: 5 });
  return pool;
}

export function isBrainConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
