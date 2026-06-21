import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { enqueueAuditJob, listJobs, type JobStatus } from "@/lib/jobs/queue";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

const STATUSES: JobStatus[] = ["queued", "running", "retrying", "completed", "failed", "dead_letter"];

const JobBody = z.object({
  orgId: z.string().min(1).optional(),
  targetUrl: z.string().url(),
  limit: z.number().int().min(1).max(50).optional(),
  workflow: z.enum(["website_audit", "enterprise_proof"]).default("website_audit"),
  runId: z.string().min(1).optional(),
  createdBy: z.enum(["dashboard", "agent", "system"]).default("dashboard"),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const jobs = await listJobs({
    orgId: auth.orgId,
    status: status && STATUSES.includes(status as JobStatus) ? (status as JobStatus) : undefined,
    limit: Number(url.searchParams.get("limit") ?? 25),
  });

  return NextResponse.json({ ok: true, jobs });
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof JobBody>;
  try {
    body = JobBody.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "targetUrl must be a valid URL." },
      { status: 400 }
    );
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }
  const fingerprint = buildRequestFingerprint(body);
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "jobs.create",
    headers: request.headers,
    fingerprint,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  const result = await enqueueAuditJob({
    orgId: auth.orgId,
    targetUrl: body.targetUrl,
    limit: body.limit,
    workflow: body.workflow,
    runId: body.runId,
    createdBy: body.createdBy,
  });

  const responseBody = {
    ok: true,
    mode: result.mode,
    job: result.job,
    task: result.task,
  };
  await saveIdempotentResult({
    orgId: auth.orgId,
    route: "jobs.create",
    headers: request.headers,
    fingerprint,
    body: responseBody,
  });

  return NextResponse.json(responseBody);
}
