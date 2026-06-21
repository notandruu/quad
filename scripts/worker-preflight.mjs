#!/usr/bin/env node
/**
 * Validates that a long-running Quad worker has enough environment to run safely.
 *
 * Usage:
 *   npm run worker:preflight
 *   QUAD_WORKER_PREFLIGHT_BASE_URL=https://app.quad.stephenhung.me npm run worker:preflight
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const required = [
  "QUAD_REDIS_REST_URL",
  "QUAD_REDIS_REST_TOKEN",
  "QUAD_WORKER_SECRET",
];

const recommended = [
  "QUAD_API_SECRET",
  "QUAD_ALLOWED_ORGS",
  "QUAD_SERVICE_TOKENS",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "QUAD_CONNECTOR_ENCRYPTION_KEY",
  "SENTRY_DSN",
  "PHOENIX_COLLECTOR_ENDPOINT",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PROJECT_ID",
  "DEEPGRAM_API_KEY",
];

const providerGroups = [
  {
    label: "anthropic",
    keys: ["ANTHROPIC_API_KEY"],
    reason: "audit/chat synthesis needs a hosted model key",
  },
  {
    label: "openai embeddings",
    keys: ["OPENAI_API_KEY"],
    reason: "brain ingestion needs an embedding provider",
  },
];

const baseUrl = normalizeBaseUrl(process.env.QUAD_WORKER_PREFLIGHT_BASE_URL ?? "");
const apiSecret = process.env.QUAD_API_SECRET;
const workerSecret = process.env.QUAD_WORKER_SECRET;
const failures = [];
const warnings = [];

console.log("\nquad worker preflight\n");

for (const key of required) {
  if (!hasEnv(key)) failures.push(`${key} is required for the hosted worker.`);
}

for (const key of recommended) {
  if (!hasEnv(key)) warnings.push(`${key} is not configured.`);
}

for (const group of providerGroups) {
  if (!group.keys.some(hasEnv)) warnings.push(`${group.label}: ${group.reason}.`);
}

if (hasEnv("QUAD_SERVICE_TOKENS")) {
  const serviceTokenCheck = checkServiceTokenShape(process.env.QUAD_SERVICE_TOKENS ?? "");
  warnings.push(...serviceTokenCheck.warnings);
  failures.push(...serviceTokenCheck.failures);
}

if (workerSecret && apiSecret && workerSecret === apiSecret) {
  warnings.push("QUAD_WORKER_SECRET matches QUAD_API_SECRET; use a scoped worker token/secret before production traffic.");
}

if (baseUrl) {
  await checkHostedBackend(baseUrl);
} else {
  warnings.push("QUAD_WORKER_PREFLIGHT_BASE_URL is not set, so hosted backend health was not checked.");
}

console.log(`required: ${required.filter(hasEnv).length}/${required.length}`);
console.log(`recommended: ${recommended.filter(hasEnv).length}/${recommended.length}`);
console.log(`hosted health: ${baseUrl ? baseUrl : "skipped"}`);

if (warnings.length > 0) {
  console.log("\nwarnings");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length > 0) {
  console.log("\nfailures");
  for (const failure of failures) console.log(`- ${failure}`);
  console.log("\nstatus: worker preflight failed\n");
  process.exit(1);
}

console.log("\nstatus: worker preflight passed\n");

function hasEnv(key) {
  return Boolean(process.env[key]?.trim());
}

function normalizeBaseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

async function checkHostedBackend(url) {
  try {
    const response = await fetch(`${url}/api/health/backend`, {
      headers: apiSecret ? { authorization: `Bearer ${apiSecret}` } : {},
    });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      failures.push(`hosted backend returned non-json health response (${response.status}).`);
      return;
    }
    if (!response.ok) {
      failures.push(`hosted backend health failed with ${response.status}: ${json.error ?? json.code ?? "unknown"}.`);
      return;
    }
    if (json.components?.redis?.status !== "ready") {
      failures.push("hosted backend Redis is not ready; worker and web app must share the same Redis.");
    }
    if (json.components?.auth?.status !== "ready") {
      warnings.push("hosted backend auth is not ready.");
    }
    if (json.components?.serviceTokens?.status !== "ready") {
      warnings.push("hosted backend service tokens are not ready.");
    }
    if (Array.isArray(json.nextActions)) {
      for (const action of json.nextActions.slice(0, 5)) warnings.push(`hosted next action: ${action}`);
    }
  } catch (error) {
    failures.push(`hosted backend health check failed: ${error instanceof Error ? error.message : String(error)}.`);
  }
}

function checkServiceTokenShape(raw) {
  try {
    const parsed = JSON.parse(raw);
    const tokens = Array.isArray(parsed) ? parsed : [parsed];
    const tokenWarnings = [];
    const tokenFailures = [];
    for (const [index, token] of tokens.entries()) {
      if (!token || typeof token !== "object") {
        tokenFailures.push(`QUAD_SERVICE_TOKENS[${index}] must be an object.`);
        continue;
      }
      if (!String(token.token ?? "").trim()) {
        tokenFailures.push(`QUAD_SERVICE_TOKENS[${index}] is missing token.`);
      }
      const scopes = Array.isArray(token.scopes) ? token.scopes.map(String) : [];
      const orgs = Array.isArray(token.orgs) ? token.orgs.map(String) : [];
      if (scopes.length === 0 || scopes.includes("*")) {
        tokenWarnings.push(`QUAD_SERVICE_TOKENS[${index}] should use least-privilege scopes instead of admin scope.`);
      }
      if (orgs.length === 0) {
        tokenWarnings.push(`QUAD_SERVICE_TOKENS[${index}] should be org-scoped.`);
      }
    }
    return { warnings: tokenWarnings, failures: tokenFailures };
  } catch {
    return {
      warnings: [],
      failures: ["QUAD_SERVICE_TOKENS must be valid JSON for Railway worker preflight."],
    };
  }
}
