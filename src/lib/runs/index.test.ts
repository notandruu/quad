import { describe, expect, it } from "vitest";
import {
  addArtifact,
  addTask,
  assertCustomerWriteAllowed,
  buildHostedRunDetail,
  createReceipt,
  createWorkflowRun,
  decideApproval,
  getHostedArtifactDetail,
  getHostedTaskDetail,
  getRunSnapshot,
  listRunSnapshots,
  loadRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  summarizeAgentTask,
  toWorkflowApprovalRow,
  toWorkflowArtifactRow,
  toWorkflowReceiptRow,
  toWorkflowRunRow,
  toWorkflowTaskRow,
  transitionRun,
  fromWorkflowApprovalRow,
  fromWorkflowArtifactRow,
  fromWorkflowReceiptRow,
  fromWorkflowRunRow,
  fromWorkflowTaskRow,
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

  it("maps workflow records to first-class durable rows and back", () => {
    const run = createWorkflowRun({
      id: "run_rows",
      orgId: "org_rows",
      workflowKind: "enterprise_proof",
      title: "Enterprise proof",
      createdBy: "dashboard",
      targetUrl: "https://example.com",
      now: "2026-06-21T01:00:00.000Z",
    });
    transitionRun(run.id, "running", { now: "2026-06-21T01:00:01.000Z" });
    const task = addTask({
      runId: run.id,
      title: "Collect evidence",
      status: "completed",
      owner: "quad",
      detail: "Evidence collected.",
      dependsOn: ["task_previous"],
      capabilityId: "browserbase.render",
      now: "2026-06-21T01:00:02.000Z",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { claims: ["sso"], nested: { ok: true } },
      now: "2026-06-21T01:00:03.000Z",
    });
    const approval = requestApproval({
      runId: run.id,
      artifactId: artifact.id,
      reason: "Needs approval.",
      evidenceVisible: true,
      now: "2026-06-21T01:00:04.000Z",
    });
    const receipt = createReceipt({
      runId: run.id,
      artifactId: artifact.id,
      approvalId: approval.id,
      status: "ready",
      summary: "Ready.",
      now: "2026-06-21T01:00:05.000Z",
    });
    const snapshot = getRunSnapshot(run.id)!;

    const runRow = toWorkflowRunRow(snapshot.run);
    const taskRow = toWorkflowTaskRow(task);
    const artifactRow = toWorkflowArtifactRow(artifact);
    const approvalRow = toWorkflowApprovalRow(approval);
    const receiptRow = toWorkflowReceiptRow(receipt);

    expect(runRow).toMatchObject({
      id: run.id,
      org_id: "org_rows",
      workflow_kind: "enterprise_proof",
      status: "needs_approval",
      target_url: "https://example.com",
    });
    expect(taskRow).toMatchObject({
      run_id: run.id,
      depends_on: ["task_previous"],
      capability_id: "browserbase.render",
    });
    expect(artifactRow).toMatchObject({
      artifact_kind: "trust_packet",
      hash: artifact.hash,
      data: { claims: ["sso"], nested: { ok: true } },
    });
    expect(approvalRow).toMatchObject({
      artifact_id: artifact.id,
      decision: "pending",
      evidence_visible: true,
    });
    expect(receiptRow).toMatchObject({
      approval_id: approval.id,
      artifact_hash: artifact.hash,
    });

    expect(
      fromWorkflowRunRow(runRow, {
        taskIds: [task.id],
        artifactIds: [artifact.id],
        approvalIds: [approval.id],
        receiptIds: [receipt.id],
      })
    ).toEqual(snapshot.run);
    expect(fromWorkflowTaskRow(taskRow)).toEqual(task);
    expect(fromWorkflowArtifactRow(artifactRow)).toEqual(artifact);
    expect(fromWorkflowApprovalRow(approvalRow)).toEqual(approval);
    expect(fromWorkflowReceiptRow(receiptRow)).toEqual(receipt);
  });

  it("builds stable hosted run, artifact, and task details", () => {
    const run = createWorkflowRun({
      id: "run_hosted_detail",
      orgId: "org_hosted",
      workflowKind: "enterprise_proof",
      title: "Hosted enterprise proof",
      createdBy: "dashboard",
      targetUrl: "https://example.com",
      now: "2026-06-21T02:00:00.000Z",
    });
    const task = addTask({
      runId: run.id,
      title: "Collect proof",
      status: "completed",
      owner: "quad",
      detail: "Proof collected.",
      now: "2026-06-21T02:00:01.000Z",
    });
    const artifact = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: {
        claim: "sso enabled",
        evidence: ["admin screenshot"],
        internalNotes: "only visible in artifact detail",
      },
      now: "2026-06-21T02:00:02.000Z",
    });
    const snapshot = getRunSnapshot(run.id)!;

    const detail = buildHostedRunDetail(snapshot);
    const artifactDetail = getHostedArtifactDetail(snapshot, artifact.id);
    const taskDetail = getHostedTaskDetail(snapshot, task.id);

    expect(detail.links).toEqual({
      self: "/api/runs/run_hosted_detail",
      artifacts: "/api/runs/run_hosted_detail/artifacts",
      tasks: "/api/runs/run_hosted_detail/tasks",
    });
    expect(detail.artifacts[0]).toMatchObject({
      id: artifact.id,
      href: `/api/runs/${run.id}/artifacts/${artifact.id}`,
      dataPreview: {
        claim: "sso enabled",
        evidence: ["admin screenshot"],
        internalNotes: "only visible in artifact detail",
      },
    });
    expect(artifactDetail).toMatchObject({
      id: artifact.id,
      data: {
        claim: "sso enabled",
        evidence: ["admin screenshot"],
        internalNotes: "only visible in artifact detail",
      },
      links: {
        self: `/api/runs/${run.id}/artifacts/${artifact.id}`,
        run: `/api/runs/${run.id}`,
      },
    });
    expect(taskDetail).toMatchObject({
      id: task.id,
      links: {
        self: `/api/runs/${run.id}/tasks/${task.id}`,
        run: `/api/runs/${run.id}`,
      },
    });
    expect(getHostedArtifactDetail(snapshot, "artifact_missing")).toBeNull();
    expect(getHostedTaskDetail(snapshot, "task_missing")).toBeNull();
  });
});
