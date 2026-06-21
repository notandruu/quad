#!/usr/bin/env node
/**
 * Runs the hosted worker canary and verifies the backend health receipt.
 *
 * Usage:
 *   QUAD_CANARY_BASE_URL=https://app.quad.stephenhung.me npm run canary:worker
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const baseUrl = normalizeBaseUrl(
  process.env.QUAD_CANARY_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000"
);
const orgId = process.env.QUAD_CANARY_ORG_ID ?? "org_brightpath";
const secret = process.env.QUAD_WORKER_SECRET ?? process.env.QUAD_API_SECRET;

const headers = {
  "content-type": "application/json",
};
if (secret) headers.authorization = `Bearer ${secret}`;

function normalizeBaseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "http://localhost:3000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

async function requestJson(path, init = {}) {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  const durationMs = Date.now() - started;
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${init.method ?? "GET"} ${path} returned non-json response (${response.status}).`);
  }
  if (!response.ok) {
    const detail = json.error ?? json.code ?? response.statusText;
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}: ${detail}`);
  }
  return { json, durationMs };
}

function assertCanaryResponse(json) {
  if (json.ok !== true) {
    throw new Error(`worker canary rejected: ${json.error ?? "unknown error"}`);
  }
  if (json.canary?.ok !== true) {
    throw new Error(`worker canary did not complete: ${json.canary?.job?.status ?? "unknown status"}`);
  }
  if (!json.canary?.enqueuedJobId) {
    throw new Error("worker canary response is missing enqueuedJobId.");
  }
}

function assertHealthResponse(json, expectedJobId) {
  if (json.canary?.seen !== true) {
    throw new Error("jobs health has not observed a worker canary receipt.");
  }
  if (json.canary?.ok !== true) {
    throw new Error(`latest worker canary is not ok: ${json.canary?.status ?? "unknown status"}`);
  }
  if (json.canary?.jobId !== expectedJobId) {
    throw new Error(`jobs health reported stale canary ${json.canary?.jobId ?? "none"}, expected ${expectedJobId}.`);
  }
  if (json.worker?.deadLetter > 0) {
    throw new Error(`worker queue has ${json.worker.deadLetter} dead-lettered jobs.`);
  }
}

console.log("\nquad worker canary\n");
console.log(`base url: ${baseUrl}`);
console.log(`org id:   ${orgId}`);
console.log(`auth:     ${secret ? "configured" : "demo fallback"}`);

const canary = await requestJson(`/api/jobs/canary?orgId=${encodeURIComponent(orgId)}`, {
  method: "POST",
});
assertCanaryResponse(canary.json);
console.log(
  `canary:  ok job=${canary.json.canary.enqueuedJobId} mode=${canary.json.canary.mode} duration=${canary.json.canary.durationMs}ms request=${canary.durationMs}ms`
);

const health = await requestJson("/api/jobs/health", { method: "GET" });
assertHealthResponse(health.json, canary.json.canary.enqueuedJobId);
console.log(
  `health:  ok queue=${health.json.worker.queueDepth} running=${health.json.worker.running} dead=${health.json.worker.deadLetter} request=${health.durationMs}ms`
);

console.log("\nstatus: worker canary passed\n");
