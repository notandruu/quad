import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import {
  addArtifact,
  createReceipt,
  decideApproval,
  getRunSnapshot,
  loadRunSnapshot,
  saveRunSnapshot,
  transitionRun,
  type ApprovalDecision,
  type ApprovalRecord,
  type ReceiptRecord,
  type RunLedgerSnapshot,
  type WorkflowArtifactRecord,
} from "@/lib/runs";

export type DecideWorkflowApprovalInput = {
  runId: string;
  approvalId: string;
  decision: Exclude<ApprovalDecision, "pending">;
  approver: string;
  orgId?: string;
  reason?: string;
  now?: string;
};

export type DecideWorkflowApprovalResult = {
  snapshot: RunLedgerSnapshot;
  approval: ApprovalRecord;
  artifact: WorkflowArtifactRecord;
  receipt: ReceiptRecord;
  packet: QuadChainPacketSummary;
};

export async function decideWorkflowApproval(
  input: DecideWorkflowApprovalInput
): Promise<DecideWorkflowApprovalResult> {
  const loaded = await loadRunSnapshot(input.runId);
  if (!loaded) throw new ApprovalDecisionError("run_not_found", 404, "Run not found.");
  if (input.orgId && loaded.run.orgId !== input.orgId) {
    throw new ApprovalDecisionError("run_not_found", 404, "Run not found.");
  }

  const existing = loaded.approvals.find((approval) => approval.id === input.approvalId);
  if (!existing) throw new ApprovalDecisionError("approval_not_found", 404, "Approval not found.");
  if (existing.decision !== "pending") {
    throw new ApprovalDecisionError("approval_already_decided", 409, "Approval has already been decided.");
  }

  const decidedAt = input.now ?? new Date().toISOString();
  const approval = decideApproval({
    runId: input.runId,
    approvalId: input.approvalId,
    decision: input.decision,
    approver: input.approver,
    now: decidedAt,
  });
  const artifact = addArtifact({
    runId: input.runId,
    kind: "approval_request",
    title: input.decision === "approved" ? "Approval accepted" : "Approval rejected",
    data: {
      approvalId: approval.id,
      decision: approval.decision,
      approver: approval.approver,
      reason: input.reason ?? approval.reason,
      decidedAt,
    },
    now: decidedAt,
  });
  const receipt = createReceipt({
    runId: input.runId,
    artifactId: artifact.id,
    approvalId: approval.id,
    status: input.decision === "approved" ? "executed" : "blocked",
    summary:
      input.decision === "approved"
        ? "Human approval recorded. The packet is cleared for staged publisher work."
        : "Human rejection recorded. Customer-facing work remains blocked.",
    now: decidedAt,
  });
  transitionRun(input.runId, input.decision === "approved" ? "completed" : "failed", {
    now: decidedAt,
    failureReason: input.decision === "rejected" ? input.reason ?? approval.reason : undefined,
  });

  const snapshot = getRunSnapshot(input.runId);
  if (!snapshot) throw new ApprovalDecisionError("run_not_found", 404, "Run not found.");
  const packet = createQuadChainPacket({
    type: "approval",
    orgId: snapshot.run.orgId,
    runId: snapshot.run.id,
    producer: "quad.operator_console",
    consumer: "quad.publisher_agent",
    sources: [
      {
        id: approval.id,
        kind: "approval",
        content: {
          decision: approval.decision,
          evidenceVisible: approval.evidenceVisible,
          approver: approval.approver,
          reason: input.reason ?? approval.reason,
        },
      },
      {
        id: artifact.id,
        kind: "artifact",
        content: {
          title: artifact.title,
          hash: artifact.hash,
        },
      },
    ],
    output: [
      `approval decision: ${approval.decision}`,
      `approval id: ${approval.id}`,
      `run id: ${snapshot.run.id}`,
      `receipt status: ${receipt.status}`,
      `customer writes: ${approval.decision === "approved" ? "staged work allowed" : "blocked"}`,
    ].join("\n"),
    answerConcepts: ["approval", approval.decision, receipt.status],
    visibility: "internal",
    createdAt: decidedAt,
  });
  const savedPacket = await saveQuadChainPacket(packet);
  await saveRunSnapshot(snapshot.run.id);

  return {
    snapshot,
    approval,
    artifact,
    receipt,
    packet: summarizeQuadChainPacket(packet) ?? savedPacket.summary,
  };
}

export class ApprovalDecisionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApprovalDecisionError";
  }
}
