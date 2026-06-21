import { describe, expect, it } from "vitest";
import { getBackendReadiness, PLATFORM_REQUIRED_TABLES } from "./readiness";

const fullEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_KEY: "service",
  QUAD_REDIS_REST_URL: "https://redis.example",
  QUAD_REDIS_REST_TOKEN: "token",
  QUAD_API_SECRET: "secret",
  QUAD_ALLOWED_ORGS: "demo-org",
  QUAD_CONNECTOR_ENCRYPTION_KEY: "encryption",
  SENTRY_DSN: "https://sentry.example",
  PHOENIX_COLLECTOR_ENDPOINT: "https://phoenix.example",
  DEEPGRAM_API_KEY: "deepgram",
  BROWSERBASE_API_KEY: "browserbase",
  BROWSERBASE_PROJECT_ID: "project",
  QUAD_RETENTION_DAYS: "30",
  QUAD_WORKER_ENABLED: "true",
};

describe("getBackendReadiness", () => {
  it("reports production ready when core tables and backends are configured", async () => {
    const report = await getBackendReadiness({
      env: fullEnv,
      now: "2026-06-21T00:00:00.000Z",
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: true }),
    });

    expect(report.ok).toBe(true);
    expect(report.mode).toBe("production_ready");
    expect(report.components.supabase.missingTables).toEqual([]);
    expect(report.nextActions).toEqual([]);
  });

  it("lists missing platform tables instead of claiming durability", async () => {
    const report = await getBackendReadiness({
      env: fullEnv,
      probeSupabase: async (table) => table !== "workflow_receipts" && table !== "quadchain_packets",
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: true }),
    });

    expect(report.ok).toBe(false);
    expect(report.mode).toBe("demo_fallback");
    expect(report.components.supabase.status).toBe("degraded");
    expect(report.components.supabase.missingTables).toEqual(["workflow_receipts", "quadchain_packets"]);
    expect(report.nextActions).toContain("Apply docs/backend/platform-schema.sql in Supabase before relying on durable runs.");
  });

  it("surfaces local fallback mode with every platform table missing", async () => {
    const report = await getBackendReadiness({
      env: {},
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ configured: false, seen: false, alive: false }),
    });

    expect(report.ok).toBe(false);
    expect(report.mode).toBe("demo_fallback");
    expect(report.components.supabase.configured).toBe(false);
    expect(report.components.supabase.missingTables).toEqual([...PLATFORM_REQUIRED_TABLES]);
    expect(report.components.redis.status).toBe("missing");
    expect(report.nextActions.length).toBeGreaterThan(5);
  });

  it("does not claim production readiness without a live worker heartbeat", async () => {
    const report = await getBackendReadiness({
      env: fullEnv,
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: false, seen: true }),
    });

    expect(report.ok).toBe(false);
    expect(report.mode).toBe("demo_fallback");
    expect(report.components.worker.status).toBe("degraded");
    expect(report.nextActions).toContain("Run npm run worker on Railway or another long-running runtime so queued jobs are processed continuously.");
  });
});

function workerHealth(input: { configured?: boolean; seen?: boolean; alive: boolean }) {
  return {
    mode: "memory" as const,
    configured: input.configured ?? true,
    seen: input.seen ?? true,
    alive: input.alive,
    workerId: input.seen === false ? null : "worker_test",
    startedAt: input.seen === false ? null : "2026-06-21T00:00:00.000Z",
    lastHeartbeatAt: input.seen === false ? null : "2026-06-21T00:00:00.000Z",
    processed: 3,
    staleAfterMs: 30000,
  };
}
