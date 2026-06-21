import { describe, expect, it, vi } from "vitest";
import { enqueueAuditJob, getJob } from "./queue";
import { processNextJob } from "./worker";

vi.mock("@/lib/tools/auditAnalyzer", () => ({
  runAudit: vi.fn(async (input: { orgId: string; runId: string; targetUrl: string }) => ({
    runId: input.runId,
    orgId: input.orgId,
    targetUrl: input.targetUrl,
    summary: "mock report",
    topFindings: [],
    allFindings: [],
    recommendedActions: [],
    metrics: {
      pagesAnalyzed: 1,
      findingsShown: 0,
      findingsFiltered: 0,
      averageConfidence: 0,
    },
  })),
}));

describe("job worker", () => {
  it("processes one queued audit job", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const enqueued = await enqueueAuditJob({
      orgId: "org_worker",
      targetUrl: "https://example.com",
      runId: "run_worker_1",
    });

    const result = await processNextJob();
    const job = await getJob(enqueued.job.id);

    expect(result.processed).toBe(true);
    expect(result.job?.id).toBe(enqueued.job.id);
    expect(job?.status).toBe("completed");
    expect(job?.result).toMatchObject({
      runId: "run_worker_1",
      orgId: "org_worker",
    });
  });
});
