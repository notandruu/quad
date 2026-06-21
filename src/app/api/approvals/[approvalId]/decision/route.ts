import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { ApprovalDecisionError, decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { summarizeAgentTask } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

const DecisionBody = z.object({
  runId: z.string().min(1),
  orgId: z.string().min(1).optional(),
  decision: z.enum(["approved", "rejected"]),
  approver: z.string().min(1).default("demo.operator"),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { approvalId: string } }
) {
  let body: z.infer<typeof DecisionBody>;
  try {
    body = DecisionBody.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "runId, decision, and approver are required.",
      },
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

  try {
    const result = await decideWorkflowApproval({
      runId: body.runId,
      approvalId: params.approvalId,
      orgId: auth.orgId,
      decision: body.decision,
      approver: body.approver,
      reason: body.reason,
    });

    return NextResponse.json({
      ok: true,
      approval: {
        id: result.approval.id,
        decision: result.approval.decision,
        decidedAt: result.approval.decidedAt,
        approver: result.approval.approver,
      },
      receipt: {
        id: result.receipt.id,
        status: result.receipt.status,
        summary: result.receipt.summary,
        artifactHash: result.receipt.artifactHash,
      },
      packet: result.packet,
      task: summarizeAgentTask(result.snapshot),
    });
  } catch (error) {
    if (error instanceof ApprovalDecisionError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Approval decision failed." }, { status: 500 });
  }
}
