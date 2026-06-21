import { describe, expect, it } from "vitest";
import {
  addArtifact,
  addTask,
  assertCustomerWriteAllowed,
  createReceipt,
  createWorkflowRun,
  decideApproval,
  getRunSnapshot,
  listRunSnapshots,
  loadRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  summarizeAgentTask,
  transitionRun,
} from ".";

describe("run ledger", () => {
  it("tracks a workflow run with artifacts, approvals, receipts, and agent summary", () => {
    const run = createWorkflowRun({
      id: "run_test_1",
      orgId: "org_1",
      workflowKind: "enterprise_proof",
      title: "Enterprise proof run",
      createdBy: "agent",
      targetUrl: "https://example.com/security",
      now: "2026-06-20T00:00:00.000Z",
    });
    transitionRun(run.id, "running", { now: "2026-06-20T00:00:01.000Z" });
    const task = addTask({
      runId: run.id,
      title: "Build trust packet",
      status: "completed",
      owner: "quad",
      detail: "Packet assembled.",
      now: "2026-06-20T00:00:02.000Z",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { claims: ["mfa"] },
      now: "2026-06-20T00:00:03.000Z",
    });
    const approval = requestApproval({
      runId: run.id,
      artifactId: artifact.id,
      reason: "Customer-facing trust packet needs human approval.",
      evidenceVisible: true,
      now: "2026-06-20T00:00:04.000Z",
    });
    const receipt = createReceipt({
      runId: run.id,
      artifactId: artifact.id,
      approvalId: approval.id,
      status: "ready",
      summary: "Ready for approval.",
      now: "2026-06-20T00:00:05.000Z",
    });

    const snapshot = getRunSnapshot(run.id);
    expect(snapshot?.run.taskIds).toEqual([task.id]);
    expect(snapshot?.run.artifactIds).toEqual([artifact.id]);
    expect(artifact.hash.startsWith("fnv1a:")).toBe(true);
    expect(snapshot?.run.approvalIds).toEqual([approval.id]);
    expect(snapshot?.run.receiptIds).toEqual([receipt.id]);
    expect(summarizeAgentTask(snapshot!).nextAction).toBe(
      "Human approval required before customer-facing work can ship."
    );
  });

  it("blocks customer writes until approval is decided", () => {
    const run = createWorkflowRun({
      id: "run_test_2",
      orgId: "org_1",
      workflowKind: "trust_packet",
      title: "Trust packet",
      createdBy: "system",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { claims: ["sso"] },
    });
    requestApproval({
      runId: run.id,
      artifactId: artifact.id,
      reason: "Needs approval.",
      evidenceVisible: true,
    });

    expect(() => assertCustomerWriteAllowed(getRunSnapshot(run.id)!)).toThrow("Approval pending");
  });

  it("allows customer writes after approval", () => {
    const run = createWorkflowRun({
      id: "run_test_3",
      orgId: "org_1",
      workflowKind: "trust_packet",
      title: "Trust packet",
      createdBy: "system",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { claims: ["sso"] },
    });
    const approval = requestApproval({
      runId: run.id,
      artifactId: artifact.id,
      reason: "Needs approval.",
      evidenceVisible: true,
    });
    decideApproval({
      runId: run.id,
      approvalId: approval.id,
      decision: "approved",
      approver: "stephen",
    });

    expect(() => assertCustomerWriteAllowed(getRunSnapshot(run.id)!)).not.toThrow();
  });

  it("persists through the memory fallback when supabase is not configured", async () => {
    const oldUrl = process.env.SUPABASE_URL;
    const oldKey = process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    try {
      const run = createWorkflowRun({
        id: "run_test_persist",
        orgId: "org_persist",
        workflowKind: "trust_packet",
        title: "Trust packet",
        createdBy: "dashboard",
        now: "2026-06-21T00:00:00.000Z",
      });
      const artifact = addArtifact({
        runId: run.id,
        kind: "trust_packet",
        title: "Trust packet",
        data: { claims: ["mfa"] },
        now: "2026-06-21T00:00:01.000Z",
      });
      requestApproval({
        runId: run.id,
        artifactId: artifact.id,
        reason: "Needs approval.",
        evidenceVisible: true,
        now: "2026-06-21T00:00:02.000Z",
      });

      const saved = await saveRunSnapshot(run.id);
      const loaded = await loadRunSnapshot(run.id);
      const listed = await listRunSnapshots({ orgId: "org_persist", status: "needs_approval" });

      expect(saved.mode).toBe("memory");
      expect(loaded?.run.id).toBe(run.id);
      expect(listed.map((snapshot) => snapshot.run.id)).toContain(run.id);
      expect(summarizeAgentTask(loaded!).approvals).toHaveLength(1);
    } finally {
      process.env.SUPABASE_URL = oldUrl;
      process.env.SUPABASE_SERVICE_KEY = oldKey;
    }
  });
});
