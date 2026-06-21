import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { enqueueAuditJob, listJobs, type JobStatus } from "@/lib/jobs/queue";

export const runtime = "nodejs";

const STATUSES: JobStatus[] = ["queued", "running", "completed", "failed"];

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
  const jobs = await listJobs({
    orgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
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

  const result = await enqueueAuditJob({
    orgId: body.orgId,
    targetUrl: body.targetUrl,
    limit: body.limit,
    workflow: body.workflow,
    runId: body.runId,
    createdBy: body.createdBy,
  });

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    job: result.job,
    task: result.task,
  });
}
