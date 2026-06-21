import { describe, expect, it, vi } from "vitest";
import { getWorkerCanaryHealth } from "./queue";
import { runScheduledWorkerCanary } from "./scheduler";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("worker canary scheduler", () => {
  it("runs once and skips repeated scheduled canaries while the receipt is fresh", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const first = await runScheduledWorkerCanary({
      orgId: "org_scheduler",
      minIntervalSeconds: 300,
      now: "2026-06-21T00:00:00.000Z",
    });
    const latest = await getWorkerCanaryHealth();
    const second = await runScheduledWorkerCanary({
      orgId: "org_scheduler",
      minIntervalSeconds: 300,
      now: new Date(Date.parse(latest.lastRunAt ?? "") + 1000).toISOString(),
    });

    expect(first).toMatchObject({
      ok: true,
      scheduled: true,
      skipped: false,
      reason: "ran",
    });
    expect(first.skipped).toBe(false);
    if (!first.skipped) {
      expect(first.canary.job.status).toBe("completed");
      expect(first.canary.enqueuedJobId).toMatch(/^job_/);
    }

    expect(second).toMatchObject({
      ok: true,
      scheduled: true,
      skipped: true,
      reason: "recent",
      canary: {
        seen: true,
        ok: true,
        jobId: latest.jobId,
      },
    });
  });
});
