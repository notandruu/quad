import { describe, expect, it } from "vitest";
import {
  addArtifact,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
} from "@/lib/runs";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { ApprovalDecisionError, decideWorkflowApproval } from "./approvalDecision";

describe("approval decisions", () => {
  it("approves a pending approval and emits an approval packet", async () => {
    const run = createWorkflowRun({
      id: "run_approval_decision_1",
      orgId: "org_approval",
      workflowKind: "trust_packet",
      title: "Trust packet",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { summary: "ready" },
      now: "2026-06-21T00:00:01.000Z",
    });
    const approval = requestApproval({
      runId: run.id,
      artifactId: artifact.id,
      reason: "Needs approval.",
      evidenceVisible: true,
      now: "2026-06-21T00:00:02.000Z",
    });

    const result = await decideWorkflowApproval({
      runId: run.id,
      approvalId: approval.id,
      orgId: "org_approval",
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T00:00:03.000Z",
    });

    const snapshot = getRunSnapshot(run.id);
    const packets = await getQuadChainPackets({ runId: run.id, type: "approval" });
    expect(result.approval.decision).toBe("approved");
    expect(result.receipt.status).toBe("executed");
    expect(result.packet.type).toBe("approval");
    expect(result.packet.accepted).toBe(true);
    expect(snapshot?.run.status).toBe("completed");
    expect(snapshot?.approvals[0]?.approver).toBe("stephen");
    expect(packets[0]?.type).toBe("approval");
  });

  it("rejects already decided approvals", async () => {
    const run = createWorkflowRun({
      id: "run_approval_decision_2",
      orgId: "org_approval",
      workflowKind: "trust_packet",
      title: "Trust packet",
      createdBy: "dashboard",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { summary: "ready" },
    });
    const approval = requestApproval({
      runId: run.id,
      artifactId: artifact.id,
      reason: "Needs approval.",
      evidenceVisible: true,
    });

    await decideWorkflowApproval({
      runId: run.id,
      approvalId: approval.id,
      decision: "rejected",
      approver: "stephen",
    });

    await expect(
      decideWorkflowApproval({
        runId: run.id,
        approvalId: approval.id,
        decision: "approved",
        approver: "stephen",
      })
    ).rejects.toMatchObject({
      code: "approval_already_decided",
      status: 409,
    } satisfies Partial<ApprovalDecisionError>);
  });
});
