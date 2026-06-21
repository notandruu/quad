import { describe, expect, it } from "vitest";
import { getObservabilityReadiness, runObservabilityProbe, validateTelemetryConfig } from "./status";

describe("observability status", () => {
  it("reports missing when no observability sinks are configured", () => {
    const readiness = getObservabilityReadiness({});

    expect(readiness).toMatchObject({
      status: "missing",
      configured: false,
      sentry: {
        configured: false,
        serverDsn: false,
        publicDsn: false,
      },
      phoenix: {
        configured: false,
        endpoint: false,
        apiKey: false,
      },
      sinks: [],
    });
  });

  it("reports degraded when only one sink is configured", () => {
    const readiness = getObservabilityReadiness({
      SENTRY_DSN: "https://sentry.example",
    });

    expect(readiness).toMatchObject({
      status: "degraded",
      configured: true,
      sinks: ["sentry"],
    });
    expect(JSON.stringify(readiness)).not.toContain("https://sentry.example");
  });

  it("reports ready when sentry and phoenix are configured without exposing keys", () => {
    const readiness = getObservabilityReadiness({
      SENTRY_DSN: "https://sentry.example",
      PHOENIX_COLLECTOR_ENDPOINT: "https://phoenix.example/v1/traces",
      PHOENIX_API_KEY: "phoenix-secret",
    });

    expect(readiness).toMatchObject({
      status: "ready",
      configured: true,
      sinks: ["sentry", "phoenix"],
      sentry: {
        configured: true,
        serverDsn: true,
      },
      phoenix: {
        configured: true,
        endpoint: true,
        apiKey: true,
      },
    });
    expect(readiness.telemetrySafety.status).toBe("pass");
    expect(JSON.stringify(readiness)).not.toContain("phoenix-secret");
    expect(JSON.stringify(readiness)).not.toContain("phoenix.example");
  });

  it("validates unsafe telemetry configuration without exposing values", () => {
    const report = validateTelemetryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://public-sentry.example",
      PHOENIX_COLLECTOR_ENDPOINT: "http://phoenix.internal/v1/traces",
      PHOENIX_API_KEY: "phoenix-secret",
      QUAD_TELEMETRY_LOG_RAW_PAYLOADS: "true",
      QUAD_TELEMETRY_LOG_RAW_PROMPTS: "1",
    });
    const readiness = getObservabilityReadiness({
      PHOENIX_COLLECTOR_ENDPOINT: "http://phoenix.internal/v1/traces",
      QUAD_TELEMETRY_LOG_RAW_RESPONSES: "yes",
    });

    expect(report).toMatchObject({
      ok: false,
      status: "blocker",
    });
    expect(report.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "public_sentry_without_server",
      "insecure_phoenix_endpoint",
      "raw_payload_logging_enabled",
      "raw_prompt_logging_enabled",
    ]));
    expect(readiness.status).toBe("degraded");
    expect(readiness.telemetrySafety.issues.map((issue) => issue.id)).toContain("raw_response_logging_enabled");
    expect(JSON.stringify(report)).not.toContain("phoenix-secret");
    expect(JSON.stringify(report)).not.toContain("phoenix.internal");
  });

  it("returns a safe no-op probe when sinks are missing", async () => {
    const probe = await runObservabilityProbe({
      orgId: "org_secret_customer",
      env: {},
      now: "2026-06-21T00:00:00.000Z",
    });

    expect(probe.ok).toBe(false);
    expect(probe.emitted).toEqual([]);
    expect(probe.readiness.status).toBe("missing");
    expect(probe.createdAt).toBe("2026-06-21T00:00:00.000Z");
    expect(probe.orgHash).toMatch(/^fnv1a:/);
    expect(JSON.stringify(probe)).not.toContain("org_secret_customer");
  });
});
