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
  OPENAI_API_KEY: "openai",
  QUAD_RETENTION_DAYS: "30",
  QUAD_WORKER_ENABLED: "true",
  QUAD_SERVICE_TOKENS: JSON.stringify([
    {
      label: "railway-worker",
      token: "worker-token",
      orgs: ["demo-org"],
      scopes: ["worker", "jobs:read", "jobs:write"],
    },
  ]),
};

describe("getBackendReadiness", () => {
  it("reports production ready when core tables and backends are configured", async () => {
    const report = await getBackendReadiness({
      env: fullEnv,
      now: "2026-06-21T00:00:00.000Z",
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: true }),
      probeCanary: async () => canaryHealth({ ok: true }),
    });

    expect(report.ok).toBe(true);
    expect(report.mode).toBe("production_ready");
    expect(report.components.supabase.missingTables).toEqual([]);
    expect(report.components.serviceTokens.status).toBe("ready");
    expect(report.components.observability).toMatchObject({
      status: "ready",
      sentry: {
        configured: true,
        serverDsn: true,
      },
      phoenix: {
        configured: true,
        endpoint: true,
      },
      sinks: ["sentry", "phoenix"],
    });
    expect(JSON.stringify(report)).not.toContain("https://sentry.example");
    expect(JSON.stringify(report)).not.toContain("https://phoenix.example");
    expect(report.components.serviceTokens.tokens).toEqual([
      {
        label: "railway-worker",
        orgScoped: true,
        scopes: ["worker", "jobs:read", "jobs:write"],
      },
    ]);
    expect(JSON.stringify(report)).not.toContain("worker-token");
    expect(report.components.worker.canary.ok).toBe(true);
    expect(report.components.capabilities).toMatchObject({
      status: "ready",
      activeCount: 10,
      blockedCount: 0,
      validation: {
        failing: 0,
        warnings: expect.any(Number),
      },
      policy: {
        allowlistCount: 0,
        disabledCount: 0,
        forceInstalledCount: 0,
        requireWriteAllowlist: true,
      },
    });
    expect(report.nextActions).toEqual([]);
  });

  it("lists missing platform tables instead of claiming durability", async () => {
    const report = await getBackendReadiness({
      env: fullEnv,
      probeSupabase: async (table) => table !== "workflow_receipts" && table !== "quadchain_packets",
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: true }),
      probeCanary: async () => canaryHealth({ ok: true }),
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
      probeCanary: async () => canaryHealth({ seen: false, ok: false }),
    });

    expect(report.ok).toBe(false);
    expect(report.mode).toBe("demo_fallback");
    expect(report.components.supabase.configured).toBe(false);
    expect(report.components.supabase.missingTables).toEqual([...PLATFORM_REQUIRED_TABLES]);
    expect(report.components.redis.status).toBe("missing");
    expect(report.components.serviceTokens.status).toBe("missing");
    expect(report.components.capabilities.status).toBe("degraded");
    expect(report.components.capabilities.validation.failing).toBeGreaterThan(0);
    expect(report.components.capabilities.blocked.map((capability) => capability.id)).toContain("openai.embeddings");
    expect(report.nextActions).toContain("Configure org-scoped QUAD_SERVICE_TOKENS for Railway workers and read-only operators.");
    expect(report.nextActions).toContain("Resolve metaregistry capability blockers before claiming the AI employee can route tools safely.");
    expect(report.nextActions.length).toBeGreaterThan(5);
  });

  it("degrades readiness when org policy disables the verifier", async () => {
    const report = await getBackendReadiness({
      env: {
        ...fullEnv,
        QUAD_CAPABILITY_DISABLED: "quad.chain_verifier",
      },
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: true }),
      probeCanary: async () => canaryHealth({ ok: true }),
    });

    expect(report.ok).toBe(false);
    expect(report.components.capabilities.status).toBe("degraded");
    expect(report.components.capabilities.validation.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityId: "quad.chain_verifier",
          label: "Runtime routing",
          status: "fail",
        }),
      ])
    );
    expect(report.components.capabilities.blocked).toContainEqual(
      expect.objectContaining({
        id: "quad.chain_verifier",
        disabled: true,
        reason: "Capability is disabled by org policy.",
      })
    );
    expect(report.nextActions).toContain("Resolve metaregistry capability blockers before claiming the AI employee can route tools safely.");
  });

  it("degrades readiness when service tokens are admin-scoped", async () => {
    const report = await getBackendReadiness({
      env: {
        ...fullEnv,
        QUAD_SERVICE_TOKENS: JSON.stringify([
          {
            label: "wide-open-worker",
            token: "wide-token",
            orgs: [],
            scopes: ["*"],
          },
        ]),
      },
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: true }),
      probeCanary: async () => canaryHealth({ ok: true }),
    });

    expect(report.ok).toBe(false);
    expect(report.components.serviceTokens.status).toBe("degraded");
    expect(report.nextActions).toContain("Configure org-scoped QUAD_SERVICE_TOKENS for Railway workers and read-only operators.");
    expect(JSON.stringify(report)).not.toContain("wide-token");
  });

  it("does not claim production readiness without a live worker heartbeat", async () => {
    const report = await getBackendReadiness({
      env: fullEnv,
      probeSupabase: async () => true,
      probeRedis: async () => true,
      probeWorker: async () => workerHealth({ alive: false, seen: true }),
      probeCanary: async () => canaryHealth({ ok: false }),
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

function canaryHealth(input: { seen?: boolean; ok: boolean }) {
  return {
    seen: input.seen ?? true,
    ok: input.ok,
    mode: "memory" as const,
    jobId: input.seen === false ? null : "job_canary",
    status: input.seen === false ? null : input.ok ? "completed" as const : "failed" as const,
    lastRunAt: input.seen === false ? null : "2026-06-21T00:00:00.000Z",
    durationMs: input.seen === false ? null : 12,
  };
}
