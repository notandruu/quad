import { describe, expect, it, vi } from "vitest";
import { getRunSnapshot } from "@/lib/runs";
import {
  claimJob,
  claimNextJob,
  deadLetterJob,
  enqueueAuditJob,
  enqueueWorkerCanaryJob,
  getJob,
  getWorkerCanaryHealth,
  getWorkerRuntimeHealth,
  getWorkerQueueHealth,
  listJobs,
  recordWorkerHeartbeat,
  recordWorkerCanaryHealth,
  requeueJob,
  retryJob,
  updateJob,
} from "./queue";

describe("job queue", () => {
  it("enqueues audit jobs with a workflow run and memory fallback", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const result = await enqueueAuditJob({
      orgId: "org_jobs",
      targetUrl: "https://example.com",
      limit: 2,
      runId: "run_job_queue_1",
    });

    const snapshot = getRunSnapshot("run_job_queue_1");
    const fetched = await getJob(result.job.id);
    const listed = await listJobs({ orgId: "org_jobs" });

    expect(result.mode).toBe("memory");
    expect(result.job.status).toBe("queued");
    expect(result.task?.runId).toBe("run_job_queue_1");
    expect(snapshot?.run.status).toBe("queued");
    expect(snapshot?.tasks[0]?.title).toBe("Queued backend job");
    expect(fetched?.payload).toMatchObject({
      targetUrl: "https://example.com",
      limit: 2,
    });
    expect(listed.map((job) => job.id)).toContain(result.job.id);
    await updateJob(result.job.id, { status: "completed" });
  });

  it("claims queued jobs and marks them running", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const result = await enqueueAuditJob({
      orgId: "org_jobs",
      targetUrl: "https://example.org",
      runId: "run_job_queue_2",
    });

    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(result.job.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempts).toBe(1);
    expect(claimed?.startedAt).toBeTruthy();
    expect(claimed?.claimedBy).toMatch(/^lease_/);
    expect(claimed?.claimExpiresAt).toBeTruthy();

    const completed = await updateJob(result.job.id, { status: "completed" });
    expect(completed?.claimedBy).toBeUndefined();
    expect(completed?.claimExpiresAt).toBeUndefined();
  });

  it("updates job status without mutating createdAt", async () => {
    const result = await enqueueAuditJob({
      orgId: "org_jobs",
      targetUrl: "https://example.net",
      runId: "run_job_queue_3",
    });
    const updated = await updateJob(result.job.id, {
      status: "completed",
      result: { ok: true },
    });

    expect(updated?.status).toBe("completed");
    expect(updated?.createdAt).toBe(result.job.createdAt);
    expect(updated?.updatedAt).toBeTruthy();
    expect(updated?.result).toEqual({ ok: true });
  });

  it("requeues retrying jobs and reports worker queue health", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const result = await enqueueAuditJob({
      orgId: "org_jobs",
      targetUrl: "https://example.edu",
      runId: "run_job_queue_4",
    });
    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(result.job.id);

    const retrying = await retryJob(claimed!, {
      error: "browser session timed out",
      retryDelayMs: -1,
      now: "2026-06-21T00:00:00.000Z",
    });
    const health = await getWorkerQueueHealth();
    const reclaimed = await claimNextJob();

    expect(retrying.status).toBe("retrying");
    expect(retrying.errorHistory?.[0]).toMatchObject({
      attempt: 1,
      message: "browser session timed out",
    });
    expect(retrying.claimedBy).toBeUndefined();
    expect(retrying.claimExpiresAt).toBeUndefined();
    expect(health.retrying).toBeGreaterThanOrEqual(1);
    expect(reclaimed?.id).toBe(result.job.id);
    expect(reclaimed?.attempts).toBe(2);
    expect(reclaimed?.claimedBy).toMatch(/^lease_/);
  });

  it("manually requeues dead letter jobs for operator recovery", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const result = await enqueueAuditJob({
      orgId: "org_jobs",
      targetUrl: "https://example.biz",
      runId: "run_job_queue_requeue",
    });
    const claimed = await claimJob(result.job.id);
    const dead = await deadLetterJob(claimed!, {
      error: "browser crashed",
      now: "2026-06-21T00:00:00.000Z",
    });

    const requeued = await requeueJob(dead, {
      reason: "browser credentials fixed",
      now: "2026-06-21T00:01:00.000Z",
    });
    const reclaimed = await claimNextJob();

    expect(requeued).toMatchObject({
      id: result.job.id,
      status: "queued",
      attempts: 0,
      deadLetteredAt: undefined,
      claimedBy: undefined,
    });
    expect(requeued.errorHistory?.at(-1)).toMatchObject({
      attempt: 1,
      message: "operator retry: browser credentials fixed",
    });
    expect(reclaimed?.id).toBe(result.job.id);
    expect(reclaimed?.attempts).toBe(1);
  });

  it("records fresh and stale worker runtime heartbeats", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    vi.stubEnv("QUAD_WORKER_HEARTBEAT_STALE_MS", "1000");

    await recordWorkerHeartbeat({
      workerId: "worker_test_1",
      startedAt: "2026-06-21T00:00:00.000Z",
      processed: 2,
      now: "2026-06-21T00:00:01.000Z",
    });

    const fresh = await getWorkerRuntimeHealth({ now: "2026-06-21T00:00:01.500Z" });
    const stale = await getWorkerRuntimeHealth({ now: "2026-06-21T00:00:03.000Z" });

    expect(fresh).toMatchObject({
      configured: true,
      seen: true,
      alive: true,
      workerId: "worker_test_1",
      processed: 2,
    });
    expect(stale.alive).toBe(false);
  });

  it("enqueues and directly claims a worker canary job", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const enqueued = await enqueueWorkerCanaryJob({
      orgId: "org_jobs",
      runId: "canary_queue_1",
      nonce: "nonce_queue_1",
    });
    const claimed = await claimJob(enqueued.job.id);

    expect(enqueued.job.type).toBe("canary");
    expect(enqueued.job.payload).toMatchObject({
      orgId: "org_jobs",
      runId: "canary_queue_1",
      nonce: "nonce_queue_1",
    });
    expect(claimed).toMatchObject({
      id: enqueued.job.id,
      type: "canary",
      status: "running",
      attempts: 1,
    });
    expect(claimed?.claimedBy).toMatch(/^lease_/);
  });

  it("records the latest worker canary health", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    await recordWorkerCanaryHealth({
      ok: true,
      mode: "memory",
      jobId: "job_canary_1",
      status: "completed",
      durationMs: 12,
      now: "2026-06-21T00:00:00.000Z",
    });

    await expect(getWorkerCanaryHealth()).resolves.toMatchObject({
      seen: true,
      ok: true,
      jobId: "job_canary_1",
      status: "completed",
      durationMs: 12,
    });
  });
});
