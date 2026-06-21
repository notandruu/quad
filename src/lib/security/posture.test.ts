import { describe, expect, it } from "vitest";
import { buildSecurityPacket, summarizeSecurityPacket } from "./posture";

describe("security posture packet", () => {
  it("reports demo hardening gaps without exposing secret values", () => {
    const packet = buildSecurityPacket({
      orgId: "org_demo",
      now: "2026-06-21T00:00:00.000Z",
      env: {
        QUAD_API_SECRET: "super-secret-value",
        ANTHROPIC_API_KEY: "sk-ant-secret",
        OPENAI_API_KEY: "sk-proj-secret",
        QUAD_REDIS_REST_URL: "https://redis.example",
        QUAD_REDIS_REST_TOKEN: "redis-secret",
        QUAD_SERVICE_TOKENS: JSON.stringify([
          {
            label: "worker",
            token: "service-token-secret",
            orgs: ["org_demo"],
            scopes: ["worker"],
          },
        ]),
      },
    });
    const serialized = JSON.stringify(packet);

    expect(packet.orgId).toBe("org_demo");
    expect(packet.generatedAt).toBe("2026-06-21T00:00:00.000Z");
    expect(packet.posture).toBe("demo_guarded");
    expect(packet.controls.find((control) => control.id === "org_allowlist")?.status).toBe("missing");
    expect(packet.controls.find((control) => control.id === "event_retention")?.status).toBe("warning");
    expect(serialized).not.toContain("super-secret-value");
    expect(serialized).not.toContain("sk-ant-secret");
    expect(serialized).not.toContain("redis-secret");
    expect(serialized).not.toContain("service-token-secret");
    expect(packet.serviceTokens).toMatchObject({
      configured: true,
      count: 1,
      scopedCount: 1,
      orgScopedCount: 1,
    });
  });

  it("marks production posture when all core controls are configured", () => {
    const packet = buildSecurityPacket({
      orgId: "org_prod",
      env: {
        QUAD_API_SECRET: "secret",
        QUAD_ALLOWED_ORGS: "org_prod",
        QUAD_RETENTION_DAYS: "30",
        QUAD_ORG_RETENTION_DAYS: JSON.stringify({ org_prod: 14 }),
        DATABASE_URL: "postgresql://user:pass@example.com/db",
        SENTRY_DSN: "https://sentry.example",
        PHOENIX_COLLECTOR_ENDPOINT: "https://phoenix.example",
        QUAD_SERVICE_TOKENS: JSON.stringify([
          {
            label: "railway-worker",
            token: "worker-token",
            orgs: ["org_prod"],
            scopes: ["worker", "jobs:read", "jobs:write"],
          },
        ]),
      },
    });

    expect(packet.posture).toBe("production_ready");
    expect(packet.score).toBe(100);
    expect(packet.controls.every((control) => control.status === "pass")).toBe(true);
    expect(packet.controls.find((control) => control.id === "service_tokens")?.status).toBe("pass");
    expect(packet.serviceTokens.tokens).toEqual([
      {
        label: "railway-worker",
        orgScoped: true,
        scopes: ["worker", "jobs:read", "jobs:write"],
      },
    ]);
    expect(packet.deletion).toMatchObject({
      configured: true,
      retentionDays: 14,
    });
    expect(packet.deletion.policy).toMatchObject({
      configured: true,
      retentionDays: 14,
      source: "org_override",
    });
    expect(packet.deletion.policy.stores.some((store) => store.store === "external_providers")).toBe(true);
  });

  it("marks unsafe telemetry config as a security blocker without leaking values", () => {
    const packet = buildSecurityPacket({
      orgId: "org_telemetry",
      env: {
        QUAD_API_SECRET: "secret",
        QUAD_ALLOWED_ORGS: "org_telemetry",
        QUAD_RETENTION_DAYS: "30",
        DATABASE_URL: "postgresql://user:pass@example.com/db",
        SENTRY_DSN: "https://sentry.example",
        PHOENIX_COLLECTOR_ENDPOINT: "http://phoenix.internal/v1/traces",
        PHOENIX_API_KEY: "phoenix-secret",
        QUAD_TELEMETRY_LOG_RAW_PAYLOADS: "true",
        QUAD_SERVICE_TOKENS: JSON.stringify([
          {
            label: "railway-worker",
            token: "worker-token",
            orgs: ["org_telemetry"],
            scopes: ["worker", "jobs:read", "jobs:write"],
          },
        ]),
      },
    });
    const control = packet.controls.find((item) => item.id === "telemetry_redaction");
    const serialized = JSON.stringify(packet);

    expect(control).toMatchObject({
      status: "missing",
      detail: "Unsafe telemetry configuration is enabled.",
    });
    expect(packet.posture).not.toBe("production_ready");
    expect(serialized).not.toContain("phoenix-secret");
    expect(serialized).not.toContain("phoenix.internal");
  });

  it("summarizes controls without raw evidence lists", () => {
    const packet = buildSecurityPacket({ orgId: "org_summary", env: {} });
    const summary = summarizeSecurityPacket(packet);

    expect(summary.controls.length).toBe(packet.controls.length);
    expect(summary.controls[0]).not.toHaveProperty("evidence");
    expect(summary.warnings.length).toBeGreaterThan(0);
  });
});
