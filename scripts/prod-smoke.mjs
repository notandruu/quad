#!/usr/bin/env node
/**
 * Runs a production backend smoke test against a hosted Quad deployment.
 *
 * Usage:
 *   QUAD_SMOKE_BASE_URL=https://quad.example.com QUAD_API_SECRET=... QUAD_WORKER_SECRET=... npm run smoke:prod
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const baseUrl = normalizeBaseUrl(
  process.env.QUAD_SMOKE_BASE_URL ??
    process.env.QUAD_CANARY_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000"
);
const orgId = process.env.QUAD_SMOKE_ORG_ID ?? process.env.QUAD_CANARY_ORG_ID ?? "org_brightpath";
const apiSecret = process.env.QUAD_API_SECRET;
const workerSecret = process.env.QUAD_WORKER_SECRET ?? apiSecret;
const requireHostedAuth = process.env.QUAD_SMOKE_REQUIRE_AUTH
  ? process.env.QUAD_SMOKE_REQUIRE_AUTH !== "0"
  : !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(baseUrl);

const checks = [];

function normalizeBaseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "http://localhost:3000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

function authHeaders(secret) {
  return secret ? { authorization: `Bearer ${secret}` } : {};
}

async function requestJson(path, init = {}) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const durationMs = Date.now() - started;
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${init.method ?? "GET"} ${path} returned non-json response (${response.status}).`);
  }
  return { response, json, durationMs };
}

async function record(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    checks.push({
      name,
      ok: true,
      durationMs: Date.now() - started,
      detail: result?.detail ?? "ok",
      warnings: result?.warnings ?? [],
    });
    return result;
  } catch (error) {
    checks.push({
      name,
      ok: false,
      durationMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
      warnings: [],
    });
    return null;
  }
}

function assertStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(`${label} returned ${result.response.status}, expected ${expected}.`);
  }
}

function assertOk(result, label) {
  if (!result.response.ok) {
    throw new Error(`${label} failed with ${result.response.status}: ${result.json.error ?? result.json.code ?? "unknown"}`);
  }
}

function summarizeBackend(report) {
  const components = report.components ?? {};
  const degraded = Object.entries(components)
    .filter(([, value]) => value?.status !== "ready")
    .map(([name, value]) => `${name}:${value?.status ?? "unknown"}`);
  return {
    detail: `mode=${report.mode ?? "unknown"} ok=${Boolean(report.ok)} degraded=${degraded.join(", ") || "none"}`,
    warnings: Array.isArray(report.nextActions) ? report.nextActions : [],
  };
}

console.log("\nquad production backend smoke\n");
console.log(`base url: ${baseUrl}`);
console.log(`org id:   ${orgId}`);
console.log(`api auth: ${apiSecret ? "configured" : "missing"}`);
console.log(`worker:   ${workerSecret ? "configured" : "missing"}`);
console.log(`guarded:  ${requireHostedAuth ? "required" : "demo fallback allowed"}`);

await record("unauthenticated worker canary is blocked", async () => {
  const result = await requestJson(`/api/jobs/canary?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
  if (requireHostedAuth) {
    assertStatus(result, 401, "unauthenticated canary");
  } else if (![200, 401].includes(result.response.status)) {
    throw new Error(`unauthenticated canary returned ${result.response.status}, expected 200 or 401.`);
  }
  return {
    detail:
      result.response.status === 401
        ? `blocked with ${result.json.code ?? result.response.status}`
        : "allowed by local demo fallback",
  };
});

const canary = await record("authenticated worker canary completes", async () => {
  if (!workerSecret) throw new Error("QUAD_WORKER_SECRET or QUAD_API_SECRET is required.");
  const result = await requestJson(`/api/jobs/canary?orgId=${encodeURIComponent(orgId)}`, {
    method: "POST",
    headers: authHeaders(workerSecret),
  });
  assertOk(result, "authenticated canary");
  if (result.json.ok !== true || result.json.canary?.ok !== true) {
    throw new Error(`canary did not complete: ${result.json.canary?.status ?? "unknown status"}`);
  }
  return {
    detail: `job=${result.json.canary.enqueuedJobId ?? "unknown"} mode=${result.json.canary.mode ?? "unknown"}`,
    jobId: result.json.canary.enqueuedJobId,
  };
});

await record("jobs health reports latest canary", async () => {
  if (!workerSecret) throw new Error("QUAD_WORKER_SECRET or QUAD_API_SECRET is required.");
  const result = await requestJson("/api/jobs/health", {
    headers: authHeaders(workerSecret),
  });
  assertOk(result, "jobs health");
  if (result.json.canary?.ok !== true) {
    throw new Error(`latest canary is not ok: ${result.json.canary?.status ?? "unknown"}`);
  }
  if (canary?.jobId && result.json.canary?.jobId !== canary.jobId) {
    throw new Error(`health reported stale canary ${result.json.canary?.jobId ?? "none"}, expected ${canary.jobId}.`);
  }
  if ((result.json.worker?.deadLetter ?? 0) > 0) {
    throw new Error(`queue has ${result.json.worker.deadLetter} dead-lettered jobs.`);
  }
  return {
    detail: `queue=${result.json.worker?.queueDepth ?? "?"} running=${result.json.worker?.running ?? "?"} dead=${result.json.worker?.deadLetter ?? "?"}`,
  };
});

await record("backend readiness reports component state", async () => {
  if (!apiSecret) throw new Error("QUAD_API_SECRET is required.");
  const result = await requestJson(`/api/health/backend?orgId=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(apiSecret),
  });
  assertOk(result, "backend readiness");
  if (!result.json.components?.supabase || !result.json.components?.redis || !result.json.components?.worker) {
    throw new Error("backend readiness response is missing required component state.");
  }
  return summarizeBackend(result.json);
});

await record("retention policy is readable with auth", async () => {
  if (!apiSecret) throw new Error("QUAD_API_SECRET is required.");
  const result = await requestJson(`/api/security/data?orgId=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(apiSecret),
  });
  assertOk(result, "retention policy");
  if (result.json.ok !== true || !result.json.policy?.retentionDays) {
    throw new Error("retention policy response is missing retentionDays.");
  }
  return {
    detail: `retention=${result.json.policy.retentionDays}d source=${result.json.policy.source ?? "unknown"}`,
    warnings: result.json.policy.warnings ?? [],
  };
});

console.log("\nchecks\n");
for (const check of checks) {
  const marker = check.ok ? "pass" : "fail";
  console.log(`${marker.padEnd(4)} ${check.name} (${check.durationMs}ms)`);
  console.log(`     ${check.detail}`);
  for (const warning of check.warnings) {
    console.log(`     next: ${warning}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`\nstatus: failed ${failed.length}/${checks.length} backend smoke checks\n`);
  process.exit(1);
}

console.log(`\nstatus: passed ${checks.length}/${checks.length} backend smoke checks\n`);
