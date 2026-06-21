import { describe, expect, it } from "vitest";
import { buildSponsorProofManifest } from "./proof";

describe("buildSponsorProofManifest", () => {
  it("marks only configured sponsor capabilities as live", () => {
    const manifest = buildSponsorProofManifest({
      generatedAt: "2026-06-21T00:00:00.000Z",
      env: {
        BROWSERBASE_API_KEY: "bb",
        BROWSERBASE_PROJECT_ID: "project",
        DEEPGRAM_API_KEY: "dg",
        SENTRY_DSN: "https://sentry.example",
      },
    });

    expect(manifest.generatedAt).toBe("2026-06-21T00:00:00.000Z");
    expect(manifest.rows.find((row) => row.sponsor === "Browserbase")?.status).toBe("live");
    expect(manifest.rows.find((row) => row.sponsor === "Deepgram")?.status).toBe("live");
    expect(manifest.rows.find((row) => row.sponsor === "Sentry")?.status).toBe("live");
    expect(manifest.rows.find((row) => row.sponsor === "Arize")?.status).toBe("fallback");
  });

  it("builds an ordered booth runbook from the manifest rows", () => {
    const manifest = buildSponsorProofManifest({
      generatedAt: "2026-06-21T00:00:00.000Z",
      env: {
        QUAD_REDIS_REST_URL: "redis-url",
        QUAD_REDIS_REST_TOKEN: "redis-token",
        BROWSERBASE_API_KEY: "browserbase-secret",
        BROWSERBASE_PROJECT_ID: "browserbase-project",
      },
    });

    expect(manifest.demoRunbook.sequence.map((step) => step.sponsor).slice(0, 3)).toEqual([
      "Redis",
      "Browserbase",
      "Deepgram",
    ]);
    expect(manifest.demoRunbook.sequence).toHaveLength(manifest.rows.length);
    expect(manifest.demoRunbook.liveRows.map((row) => row.sponsor)).toEqual(["Redis", "Browserbase", "Fetch.ai"]);
    expect(manifest.demoRunbook.fallbackRows.length + manifest.demoRunbook.plannedRows.length).toBeGreaterThan(0);
    expect(manifest.demoRunbook.sequence.find((step) => step.sponsor === "Redis")).toMatchObject({
      status: "live",
      safeToSay: true,
      routeOrSurface: "Live logs + /api/jobs/health",
    });
    expect(manifest.demoRunbook.sequence.find((step) => step.sponsor === "Deepgram")).toMatchObject({
      status: "fallback",
      safeToSay: false,
    });
    expect(manifest.demoRunbook.judgeScript[0]).toContain("/api/sponsor/proof");
  });

  it("does not expose secret values in the manifest", () => {
    const manifest = buildSponsorProofManifest({
      env: {
        DEEPGRAM_API_KEY: "deepgram-secret",
        SENTRY_DSN: "sentry-secret",
        PHOENIX_COLLECTOR_ENDPOINT: "phoenix-secret",
        QUAD_REDIS_REST_TOKEN: "redis-secret",
      },
    });
    const serialized = JSON.stringify(manifest);

    expect(serialized).not.toContain("deepgram-secret");
    expect(serialized).not.toContain("sentry-secret");
    expect(serialized).not.toContain("phoenix-secret");
    expect(serialized).not.toContain("redis-secret");
    expect(serialized).toContain("Deepgram");
    expect(serialized).toContain("boothChecklist");
  });
});
