import { NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { listRunSnapshots, summarizeAgentTask, type WorkflowRunStatus } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

const RUN_STATUSES: WorkflowRunStatus[] = ["queued", "running", "needs_approval", "completed", "failed"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const snapshots = await listRunSnapshots({
    orgId: auth.orgId,
    status: status && RUN_STATUSES.includes(status as WorkflowRunStatus) ? (status as WorkflowRunStatus) : undefined,
    limit: Number(url.searchParams.get("limit") ?? 25),
  });

  return NextResponse.json({
    ok: true,
    runs: snapshots.map((snapshot) => summarizeAgentTask(snapshot)),
    pendingApprovals: snapshots.flatMap((snapshot) =>
      snapshot.approvals
        .filter((approval) => approval.decision === "pending")
        .map((approval) => ({
          ...approval,
          runTitle: snapshot.run.title,
          targetUrl: snapshot.run.targetUrl ?? null,
        }))
    ),
  });
}
