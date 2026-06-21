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
  });

  it("marks production posture when all core controls are configured", () => {
    const packet = buildSecurityPacket({
      orgId: "org_prod",
      env: {
        QUAD_API_SECRET: "secret",
        QUAD_ALLOWED_ORGS: "org_prod",
        QUAD_RETENTION_DAYS: "30",
        DATABASE_URL: "postgresql://user:pass@example.com/db",
        SENTRY_DSN: "https://sentry.example",
        PHOENIX_COLLECTOR_ENDPOINT: "https://phoenix.example",
      },
    });

    expect(packet.posture).toBe("production_ready");
    expect(packet.score).toBe(100);
    expect(packet.controls.every((control) => control.status === "pass")).toBe(true);
    expect(packet.deletion).toMatchObject({
      configured: true,
      retentionDays: 30,
    });
    expect(packet.deletion.policy).toMatchObject({
      configured: true,
      retentionDays: 30,
    });
    expect(packet.deletion.policy.stores.some((store) => store.store === "external_providers")).toBe(true);
  });

  it("summarizes controls without raw evidence lists", () => {
    const packet = buildSecurityPacket({ orgId: "org_summary", env: {} });
    const summary = summarizeSecurityPacket(packet);

    expect(summary.controls.length).toBe(packet.controls.length);
    expect(summary.controls[0]).not.toHaveProperty("evidence");
    expect(summary.warnings.length).toBeGreaterThan(0);
  });
});
