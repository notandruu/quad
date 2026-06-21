#!/usr/bin/env node
/**
 * Checks whether DATABASE_URL has the Quad platform schema installed.
 *
 * Usage:
 *   npm run db:status
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const REQUIRED_TABLES = [
  "brain_memory",
  "workflow_run_snapshots",
  "workflow_runs",
  "workflow_tasks",
  "workflow_artifacts",
  "workflow_approvals",
  "workflow_receipts",
  "quadchain_packets",
  "connector_credentials",
];

const databaseUrl = process.env.DATABASE_URL;

function fail(message) {
  console.error(`\nerror: ${message}\n`);
  process.exit(1);
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = "user";
    if (parsed.password) parsed.password = "redacted";
    return parsed.toString();
  } catch {
    return "[unparseable database url]";
  }
}

function sslConfig(url) {
  return url.includes("localhost") || url.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false };
}

if (!databaseUrl) {
  fail("DATABASE_URL is required. set it in .env.local or the deploy environment.");
}

console.log("\nquad platform schema status\n");
console.log(`database: ${redactDatabaseUrl(databaseUrl)}`);

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: sslConfig(databaseUrl),
});

try {
  await client.connect();

  const tableResult = await client.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [REQUIRED_TABLES]
  );
  const presentTables = new Set(tableResult.rows.map((row) => String(row.table_name)));
  const missingTables = REQUIRED_TABLES.filter((table) => !presentTables.has(table));

  const extensionResult = await client.query(
    "select exists(select 1 from pg_extension where extname = 'vector') as installed"
  );
  const vectorInstalled = Boolean(extensionResult.rows[0]?.installed);

  console.log(`tables:   ${REQUIRED_TABLES.length - missingTables.length}/${REQUIRED_TABLES.length}`);
  console.log(`vector:   ${vectorInstalled ? "installed" : "missing"}`);

  if (missingTables.length > 0) {
    console.log(`missing:  ${missingTables.join(", ")}`);
  }

  if (missingTables.length > 0 || !vectorInstalled) {
    fail("platform schema is incomplete. run npm run db:migrate after fixing database connectivity.");
  }

  console.log("\nstatus: platform schema ready\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/enotfound/i.test(message)) {
    fail(`${message}. check that DATABASE_URL uses the correct postgres host for the Supabase project.`);
  }
  fail(message);
} finally {
  await client.end().catch(() => undefined);
}
