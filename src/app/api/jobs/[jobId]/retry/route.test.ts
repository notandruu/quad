import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { getRunSnapshot } from "@/lib/runs";
import { claimJob, deadLetterJob, enqueueAuditJob, updateJob } from "@/lib/jobs/queue";
import { POST } from "./route";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("POST /api/jobs/[jobId]/retry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requeues a dead letter job and records a run ledger task", async () => {
    clearHostedEnv();
    const enqueued = await enqueueAuditJob({
      orgId: DEMO_ORG_ID,
      targetUrl: "https://example.com",
      runId: "run_job_retry_route",
    });
    const claimed = await claimJob(enqueued.job.id);
    const dead = await deadLetterJob(claimed!, {
      error: "browser session failed",
      now: "2026-06-21T00:00:00.000Z",
    });

    const response = await POST(jsonRequest(dead.id, {
      reason: "browser credentials fixed",
    }), {
      params: { jobId: dead.id },
    });
    const body = await response.json();
    const snapshot = getRunSnapshot("run_job_retry_route");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      job: {
        id: dead.id,
        status: "queued",
        attempts: 0,
      },
      ledger: {
        recorded: true,
        runId: "run_job_retry_route",
      },
    });
    expect(body.job).not.toHaveProperty("deadLetteredAt");
    expect(snapshot?.run.status).toBe("queued");
    expect(snapshot?.tasks.at(-1)).toMatchObject({
      title: "Operator retried backend job",
      status: "queued",
      owner: "human",
      detail: "browser credentials fixed",
    });
  });

  it("rejects retrying completed jobs", async () => {
    clearHostedEnv();
    const enqueued = await enqueueAuditJob({
      orgId: DEMO_ORG_ID,
      targetUrl: "https://example.org",
      runId: "run_job_retry_completed",
    });
    await updateJob(enqueued.job.id, { status: "completed" });

    const response = await POST(jsonRequest(enqueued.job.id, {
      reason: "should not happen",
    }), {
      params: { jobId: enqueued.job.id },
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "job_not_retryable",
      job: {
        status: "completed",
      },
    });
  });

  it("replays an idempotent retry after the job has been requeued", async () => {
    clearHostedEnv();
    const enqueued = await enqueueAuditJob({
      orgId: DEMO_ORG_ID,
      targetUrl: "https://example.net",
      runId: "run_job_retry_idempotent",
    });
    const claimed = await claimJob(enqueued.job.id);
    const dead = await deadLetterJob(claimed!, {
      error: "model timeout",
      now: "2026-06-21T00:00:00.000Z",
    });

    const first = await POST(jsonRequest(dead.id, {
      reason: "model budget raised",
    }, {
      "idempotency-key": "retry-route-key",
    }), {
      params: { jobId: dead.id },
    });
    const replay = await POST(jsonRequest(dead.id, {
      reason: "model budget raised",
    }, {
      "idempotency-key": "retry-route-key",
    }), {
      params: { jobId: dead.id },
    });
    const replayBody = await replay.json();

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replayBody).toMatchObject({
      ok: true,
      idempotency: {
        replayed: true,
        key: "retry-route-key",
      },
      job: {
        id: dead.id,
        status: "queued",
      },
    });
  });
});

function clearHostedEnv() {
  vi.stubEnv("QUAD_API_SECRET", "");
  vi.stubEnv("QUAD_SERVICE_TOKENS", "");
  vi.stubEnv("QUAD_ALLOWED_ORGS", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "");
  vi.stubEnv("QUAD_REDIS_REST_URL", "");
  vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
}

function jsonRequest(
  jobId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost/api/jobs/${jobId}/retry`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
