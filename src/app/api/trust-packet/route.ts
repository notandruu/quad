import { NextRequest, NextResponse } from "next/server";
import { buildDashboardTrustPacket } from "@/lib/fde/trustPacketService";
import { loadCachedReport } from "@/lib/runtime/reportCache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const runId = String(body.runId ?? "");

  if (!runId) {
    return NextResponse.json({ ok: false, error: "runId is required" }, { status: 400 });
  }

  const report = await loadCachedReport(runId);
  if (!report) {
    return NextResponse.json({ ok: false, error: "audit report not found" }, { status: 404 });
  }

  const result = await buildDashboardTrustPacket({ report });

  return NextResponse.json({
    ok: true,
    packet: result.packet,
    task: result.task,
    workflow: {
      workflowId: result.workflow.workflowId,
      title: result.workflow.title,
      approvalTier: result.workflow.approvalTier,
      receiptPreview: result.workflow.receiptPreview,
      artifacts: result.workflow.artifacts,
      steps: result.workflow.steps,
      openObligations: result.workflow.openObligations,
    },
  });
}
