#!/usr/bin/env node
/**
 * Applies the Quad platform schema against DATABASE_URL.
 *
 * Usage:
 *   npm run db:migrate:dry
 *   npm run db:migrate
 */
import { config } from "dotenv";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const schemaPath = resolve(__dirname, "../docs/backend/platform-schema.sql");
const databaseUrl = process.env.DATABASE_URL;

function fail(message) {
  console.error(`\nerror: ${message}\n`);
  process.exit(1);
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "redacted";
    if (parsed.username) parsed.username = parsed.username ? "user" : "";
    return parsed.toString();
  } catch {
    return "[unparseable database url]";
  }
}

function splitStatements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

if (!databaseUrl) {
  fail("DATABASE_URL is required. set it in .env.local or the deploy environment.");
}

const sql = await readFile(schemaPath, "utf8");
const statements = splitStatements(sql);

console.log("\nquad platform migration\n");
console.log(`database:   ${redactDatabaseUrl(databaseUrl)}`);
console.log(`schema:     ${schemaPath}`);
console.log(`statements: ${statements.length}`);
console.log(`mode:       ${dryRun ? "dry run" : "apply"}`);

if (dryRun) {
  console.log("\nstatus: migration sql parsed successfully\n");
  process.exit(0);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("\nstatus: platform schema applied\n");
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // ignore rollback failures so the original migration error stays visible.
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/enotfound/i.test(message)) {
    fail(`${message}. check that DATABASE_URL uses the correct postgres host for the Supabase project.`);
  }
  fail(message);
} finally {
  await client.end().catch(() => undefined);
}
