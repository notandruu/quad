import { NextRequest, NextResponse } from "next/server";
import { buildDashboardTrustPacket } from "@/lib/fde/trustPacketService";
import { loadCachedReport } from "@/lib/runtime/reportCache";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

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

  const auth = authorizeRequest({
    headers: req.headers,
    requestedOrgId: report.orgId,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }
  const fingerprint = buildRequestFingerprint({ runId, reportOrgId: report.orgId });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "trust_packet.create",
    headers: req.headers,
    fingerprint,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  const result = await buildDashboardTrustPacket({ report });

  const responseBody = {
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
  };
  await saveIdempotentResult({
    orgId: auth.orgId,
    route: "trust_packet.create",
    headers: req.headers,
    fingerprint,
    body: responseBody,
  });

  return NextResponse.json(responseBody);
}
