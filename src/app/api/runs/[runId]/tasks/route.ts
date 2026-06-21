import { NextRequest, NextResponse } from "next/server";
import { buildHostedRunDetail, loadRunSnapshot } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const snapshot = await loadRunSnapshot(params.runId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "run not found" }, { status: 404 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: snapshot.run.orgId,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const detail = buildHostedRunDetail(snapshot);
  return NextResponse.json({
    ok: true,
    runId: snapshot.run.id,
    tasks: detail.tasks,
    taskEvents: detail.taskEvents,
  });
}
