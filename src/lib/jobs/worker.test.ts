import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueAuditJob, getJob, getWorkerCanaryHealth } from "./queue";
import { processNextJob, runWorkerCanary } from "./worker";
import { runAudit } from "@/lib/tools/auditAnalyzer";

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
  beforeEach(() => {
    vi.mocked(runAudit).mockImplementation(async (input: { orgId: string; runId: string; targetUrl: string }) => ({
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
    }));
  });

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

  it("retries transient failures before moving a job to dead letter", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    vi.stubEnv("QUAD_WORKER_RETRY_DELAY_MS", "0");
    vi.mocked(runAudit).mockRejectedValue(new Error("browser crashed"));

    const enqueued = await enqueueAuditJob({
      orgId: "org_worker",
      targetUrl: "https://example.com",
      runId: "run_worker_retry",
    });

    const first = await processNextJob();
    const firstJob = await getJob(enqueued.job.id);
    expect(first.job?.status).toBe("retrying");
    expect(firstJob?.status).toBe("retrying");
    expect(firstJob?.errorHistory).toHaveLength(1);

    await processNextJob();
    const secondJob = await getJob(enqueued.job.id);
    expect(secondJob?.status).toBe("retrying");
    expect(secondJob?.errorHistory).toHaveLength(2);

    await processNextJob();
    const finalJob = await getJob(enqueued.job.id);
    expect(finalJob?.status).toBe("dead_letter");
    expect(finalJob?.deadLetteredAt).toBeTruthy();
    expect(finalJob?.errorHistory).toHaveLength(3);
  });

  it("runs a synthetic worker canary through queue claim and processing", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const canary = await runWorkerCanary({ orgId: "org_worker" });
    const job = await getJob(canary.enqueuedJobId);

    expect(canary.ok).toBe(true);
    expect(canary.mode).toBe("memory");
    expect(canary.job).toMatchObject({
      type: "canary",
      status: "completed",
      orgId: "org_worker",
      attempts: 1,
    });
    expect(job?.claimedBy).toBeUndefined();
    expect(job?.claimExpiresAt).toBeUndefined();
    await expect(getWorkerCanaryHealth()).resolves.toMatchObject({
      seen: true,
      ok: true,
      jobId: canary.enqueuedJobId,
      status: "completed",
    });
  });
});
