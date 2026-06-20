import { describe, it, expect } from "vitest";
import {
  summarizeBackends,
  isDemoReady,
  liveCount,
  summarizeReadiness,
  type BackendSettings,
} from "./status";

function settings(overrides: Partial<BackendSettings> = {}): BackendSettings {
  return {
    redis: false,
    brain: false,
    embeddings: false,
    browserbase: false,
    phoenix: false,
    sentry: false,
    voice: false,
    voiceClientUrl: null,
    voiceDecision: "Moshi should be self-hosted behind a websocket endpoint before voice is enabled.",
    voiceNextAction: "Provision a Moshi server.",
    chatModel: null,
    auditModel: null,
    ...overrides,
  };
}

describe("summarizeBackends", () => {
  it("returns one row per backend with the right live flag", () => {
    const rows = summarizeBackends(settings({ redis: true, sentry: true }));
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.key === "redis")?.live).toBe(true);
    expect(rows.find((r) => r.key === "brain")?.live).toBe(false);
  });

  it("sorts live backends ahead of offline ones", () => {
    const rows = summarizeBackends(settings({ phoenix: true }));
    expect(rows[0].live).toBe(true);
    expect(rows[rows.length - 1].live).toBe(false);
  });

  it("carries a fallback message for every row", () => {
    for (const row of summarizeBackends(settings())) {
      expect(row.fallback.length).toBeGreaterThan(0);
    }
  });
});

describe("isDemoReady", () => {
  it("requires Redis and Browserbase", () => {
    expect(isDemoReady(settings({ redis: true, browserbase: true }))).toBe(true);
    expect(isDemoReady(settings({ redis: true }))).toBe(false);
    expect(isDemoReady(settings())).toBe(false);
  });
});

describe("liveCount", () => {
  it("counts live rows out of total", () => {
    const rows = summarizeBackends(settings({ redis: true, brain: true }));
    expect(liveCount(rows)).toEqual({ live: 2, total: 7 });
  });
});

describe("summarizeReadiness", () => {
  it("reports fallback mode until redis and browserbase are live", () => {
    const summary = summarizeReadiness(settings({ sentry: true, phoenix: true }));
    expect(summary.tone).toBe("fallback");
    expect(summary.label).toBe("Fallback mode");
    expect(summary.nextAction).toContain("Redis");
  });

  it("reports demo spine live when redis and browserbase are configured", () => {
    const summary = summarizeReadiness(settings({ redis: true, browserbase: true }));
    expect(summary.tone).toBe("demo");
    expect(summary.label).toBe("Demo spine live");
    expect(summary.items.find((item) => item.label === "Live audit spine")?.live).toBe(true);
  });

  it("reports production wired when every backend is live", () => {
    const summary = summarizeReadiness(
      settings({
        redis: true,
        browserbase: true,
        brain: true,
        embeddings: true,
        phoenix: true,
        sentry: true,
        voice: true,
      })
    );

    expect(summary.tone).toBe("production");
    expect(summary.score).toBe(100);
  });
});
