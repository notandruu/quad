import { describe, it, expect } from "vitest";
import {
  summarizeBackends,
  isDemoReady,
  liveCount,
  type BackendSettings,
} from "./status";

function settings(overrides: Partial<BackendSettings> = {}): BackendSettings {
  return {
    redis: false,
    brain: false,
    browserbase: false,
    phoenix: false,
    sentry: false,
    voice: false,
    chatModel: null,
    auditModel: null,
    ...overrides,
  };
}

describe("summarizeBackends", () => {
  it("returns one row per backend with the right live flag", () => {
    const rows = summarizeBackends(settings({ redis: true, sentry: true }));
    expect(rows).toHaveLength(6);
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
    expect(liveCount(rows)).toEqual({ live: 2, total: 6 });
  });
});
