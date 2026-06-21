import { NextRequest, NextResponse } from "next/server";
import { authorizeRunAccess } from "@/lib/runs/access";
import { getHostedTaskDetail } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string; taskId: string } }
) {
  const access = await authorizeRunAccess({ runId: params.runId, headers: request.headers });
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });

  const task = getHostedTaskDetail(access.snapshot, params.taskId);
  if (!task) {
    return NextResponse.json({ ok: false, error: "task not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, task });
}
