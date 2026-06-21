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

  it("does not expose secret values in the manifest", () => {
    const manifest = buildSponsorProofManifest({
      env: {
        DEEPGRAM_API_KEY: "deepgram-secret",
        SENTRY_DSN: "sentry-secret",
        PHOENIX_COLLECTOR_ENDPOINT: "phoenix-secret",
      },
    });
    const serialized = JSON.stringify(manifest);

    expect(serialized).not.toContain("deepgram-secret");
    expect(serialized).not.toContain("sentry-secret");
    expect(serialized).not.toContain("phoenix-secret");
    expect(serialized).toContain("Deepgram");
  });
});
