import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getJob, requeueJob, type JobStatus, type QuadJob } from "@/lib/jobs/queue";
import { addTask, saveRunSnapshot, transitionRun } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

const RetryBody = z.object({
  reason: z.string().trim().min(1).max(240).default("Manual operator retry."),
  resetAttempts: z.boolean().default(true),
});

const RETRYABLE_STATUSES: JobStatus[] = ["dead_letter", "failed", "retrying"];

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = await getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: job.orgId,
    requiredScopes: ["jobs:write"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  let body: z.infer<typeof RetryBody>;
  try {
    body = RetryBody.parse(await parseJson(request));
  } catch {
    return NextResponse.json(
      { ok: false, error: "reason must be a non-empty string under 240 characters." },
      { status: 400 }
    );
  }

  const fingerprint = buildRequestFingerprint({
    jobId: job.id,
    reason: body.reason,
    resetAttempts: body.resetAttempts,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "jobs.retry",
    headers: request.headers,
    fingerprint,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  if (!RETRYABLE_STATUSES.includes(job.status)) {
    return NextResponse.json(
      {
        ok: false,
        code: "job_not_retryable",
        error: `Job ${job.id} is ${job.status} and cannot be manually retried.`,
        job,
      },
      { status: 409 }
    );
  }

  const retried = await requeueJob(job, {
    reason: body.reason,
    resetAttempts: body.resetAttempts,
  });
  const ledger = await recordRetryTask(retried, body.reason);
  const responseBody = {
    ok: true,
    job: retried,
    ledger,
  };

  await saveIdempotentResult({
    orgId: auth.orgId,
    route: "jobs.retry",
    headers: request.headers,
    fingerprint,
    body: responseBody,
  });

  return NextResponse.json(responseBody);
}

async function parseJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function recordRetryTask(job: QuadJob, reason: string) {
  try {
    transitionRun(job.runId, "queued");
    const task = addTask({
      runId: job.runId,
      title: "Operator retried backend job",
      status: "queued",
      owner: "human",
      detail: reason,
    });
    await saveRunSnapshot(job.runId);
    return {
      recorded: true,
      runId: job.runId,
      taskId: task.id,
    };
  } catch {
    return {
      recorded: false,
      runId: job.runId,
      warning: "Run ledger was unavailable for this job retry.",
    };
  }
}
