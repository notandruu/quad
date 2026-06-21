import { NextRequest, NextResponse } from "next/server";
import { authorizeRunAccess } from "@/lib/runs/access";
import { buildHostedRunDetail } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const access = await authorizeRunAccess({ runId: params.runId, headers: request.headers });
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });

  const detail = buildHostedRunDetail(access.snapshot);
  return NextResponse.json({
    ok: true,
    runId: access.snapshot.run.id,
    tasks: detail.tasks,
    taskEvents: detail.taskEvents,
  });
}
