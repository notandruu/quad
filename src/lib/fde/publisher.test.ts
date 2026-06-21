import { describe, expect, it } from "vitest";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import {
  addArtifact,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  summarizeTaskStream,
} from "@/lib/runs";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { DryRunPublishError, dryRunPublish } from "./publisher";

describe("dry-run publisher", () => {
  it("blocks unapproved trust packets", async () => {
    const run = createRunWithTrustPacket("run_publish_blocked");

    await expect(dryRunPublish({ runId: run.runId, orgId: "org_publish" })).rejects.toMatchObject({
      code: "approval_required",
      status: 409,
    } satisfies Partial<DryRunPublishError>);
  });

  it("stages cms, task, and export artifacts after approval", async () => {
    const run = createRunWithTrustPacket("run_publish_approved");
    await decideWorkflowApproval({
      runId: run.runId,
      approvalId: run.approvalId,
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T00:00:03.000Z",
    });

    const result = await dryRunPublish({
      runId: run.runId,
      orgId: "org_publish",
      actor: "test.publisher",
      now: "2026-06-21T00:00:04.000Z",
      env: publisherEnv(),
    });

    const snapshot = getRunSnapshot(run.runId);
    const packets = await getQuadChainPackets({ runId: run.runId, type: "connector_action" });
    expect(result.staged.map((item) => item.artifact.kind)).toEqual([
      "cms_draft",
      "task_draft",
      "trust_packet_export",
    ]);
    expect(result.staged.every((item) => item.packet.type === "connector_action")).toBe(true);
    expect(snapshot?.artifacts.some((artifact) => artifact.kind === "cms_draft")).toBe(true);
    expect(snapshot?.receipts.filter((receipt) => receipt.status === "ready").length).toBeGreaterThanOrEqual(3);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.completed")).toHaveLength(3);
    expect(packets).toHaveLength(3);
  });

  it("blocks staging when write connector capabilities are not allowlisted", async () => {
    const run = createRunWithTrustPacket("run_publish_policy_blocked");
    await decideWorkflowApproval({
      runId: run.runId,
      approvalId: run.approvalId,
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T00:00:03.000Z",
    });

    await expect(
      dryRunPublish({
        runId: run.runId,
        orgId: "org_publish",
        actor: "test.publisher",
        now: "2026-06-21T00:00:04.000Z",
        env: {},
      })
    ).rejects.toMatchObject({
      code: "capability_blocked",
      status: 409,
    } satisfies Partial<DryRunPublishError>);

    const snapshot = getRunSnapshot(run.runId);
    expect(snapshot?.artifacts.some((artifact) => artifact.kind === "cms_draft")).toBe(false);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.blocked")).toHaveLength(2);
    expect(summarizeTaskStream(snapshot!).map((event) => event.capabilityId)).toEqual(
      expect.arrayContaining(["cms.publisher", "task.publisher"])
    );
  });
});

function publisherEnv() {
  return {
    QUAD_CAPABILITY_ALLOWLIST: "cms.publisher,task.publisher,trust_packet.exporter",
    QUAD_CAPABILITY_FORCE_INSTALLED: "cms.publisher,task.publisher",
    CMS_API_KEY: "cms_test",
    LINEAR_API_KEY: "linear_test",
  };
}

function createRunWithTrustPacket(runId: string): { runId: string; approvalId: string } {
  const run = createWorkflowRun({
    id: runId,
    orgId: "org_publish",
    workflowKind: "trust_packet",
    title: "Enterprise proof trust packet",
    createdBy: "dashboard",
    targetUrl: "https://example.com",
    now: "2026-06-21T00:00:00.000Z",
  });
  const artifact = addArtifact({
    runId: run.id,
    kind: "trust_packet",
    title: "Enterprise proof trust packet",
    data: {
      targetUrl: "https://example.com",
      artifacts: [
        {
          title: "Missing security proof",
          summary: "Add a concise security proof block with controls and owner.",
        },
      ],
    },
    now: "2026-06-21T00:00:01.000Z",
  });
  const approval = requestApproval({
    runId: run.id,
    artifactId: artifact.id,
    reason: "Needs approval.",
    evidenceVisible: true,
    now: "2026-06-21T00:00:02.000Z",
  });

  return { runId: run.id, approvalId: approval.id };
}
