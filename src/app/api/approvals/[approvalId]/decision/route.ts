import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { ApprovalDecisionError, decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { summarizeAgentTask } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";
// Approval decisions do the slowest mutation I/O (Supabase upsert + Redis +
// quadchain save); give them headroom over the serverless default.
export const maxDuration = 30;

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
  const route = `approvals.${params.approvalId}.decision`;
  const fingerprint = buildRequestFingerprint(body);
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route,
    headers: request.headers,
    fingerprint,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
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

    const responseBody = {
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
      sideEffect: result.sideEffect ?? null,
      task: summarizeAgentTask(result.snapshot),
    };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route,
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof ApprovalDecisionError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Approval decision failed." }, { status: 500 });
  }
}
