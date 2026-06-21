import { describe, expect, it, vi } from "vitest";
import { getRunSnapshot } from "@/lib/runs";
import { claimNextJob, enqueueAuditJob, getJob, listJobs, updateJob } from "./queue";

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
});
