import { describe, expect, it } from "vitest";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { getEvidenceBundles } from "@/lib/storage/evidence";
import {
  addArtifact,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  summarizeTaskStream,
} from "@/lib/runs";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { verifyPublishedWork } from "./verification";
import { dryRunPublish } from "./publisher";
import { ApprovedPublishError, executeApprovedPublish } from "./execution";

describe("approved publisher execution", () => {
  it("blocks execution before approval", async () => {
    const run = createRunWithTrustPacket("run_execute_blocked");

    await expect(executeApprovedPublish({ runId: run.runId, orgId: "org_execute" })).rejects.toMatchObject({
      code: "approval_required",
      status: 409,
    } satisfies Partial<ApprovedPublishError>);
  });

  it("requires staged connector drafts", async () => {
    const run = createRunWithTrustPacket("run_execute_missing_drafts");
    await decideWorkflowApproval({
      runId: run.runId,
      approvalId: run.approvalId,
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T00:00:03.000Z",
    });

    await expect(
      executeApprovedPublish({
        runId: run.runId,
        orgId: "org_execute",
        env: publisherEnv(),
      })
    ).rejects.toMatchObject({
      code: "drafts_missing",
      status: 404,
    } satisfies Partial<ApprovedPublishError>);
  });

  it("executes staged drafts with receipts, packets, and verifier coverage", async () => {
    const run = createRunWithTrustPacket("run_execute_approved");
    await decideWorkflowApproval({
      runId: run.runId,
      approvalId: run.approvalId,
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T00:00:03.000Z",
    });
    await dryRunPublish({
      runId: run.runId,
      orgId: "org_execute",
      actor: "test.publisher",
      now: "2026-06-21T00:00:04.000Z",
      env: publisherEnv(),
    });

    const result = await executeApprovedPublish({
      runId: run.runId,
      orgId: "org_execute",
      actor: "test.publisher",
      now: "2026-06-21T00:00:05.000Z",
      env: publisherEnv(),
    });
    const snapshot = getRunSnapshot(run.runId);
    const packets = await getQuadChainPackets({ runId: run.runId, type: "connector_action" });
    const verification = await verifyPublishedWork({
      runId: run.runId,
      orgId: "org_execute",
      actor: "test.verifier",
      now: "2026-06-21T00:00:06.000Z",
    });

    expect(result.executed).toHaveLength(3);
    expect(result.browserActions).toHaveLength(1);
    expect(result.executed.map((item) => item.artifact.kind)).toEqual([
      "connector_execution",
      "connector_execution",
      "connector_execution",
    ]);
    expect(result.browserActions[0]?.artifact.data).toMatchObject({
      schemaVersion: "quad.browser_action.v1",
      connector: { id: "browserbase.write_browser", mode: "approved_browser_write" },
      target: { selector: "[data-quad-proof-block]" },
      action: {
        type: "fill_and_pause_before_submit",
        submitted: false,
        approvalRequired: true,
        autonomy: {
          tier: "tier_2_confirm",
          label: "draft and confirm",
          submitsExternally: false,
          nextTier: "tier_3_approve",
        },
      },
      evidence: {
        before: { kind: "browser_action", storageMode: "external_provider", hash: expect.stringMatching(/^fnv1a:/) },
        after: { kind: "browser_action", storageMode: "external_provider", hash: expect.stringMatching(/^fnv1a:/) },
      },
      verification: { required: true, screenshotEvidenceIds: expect.arrayContaining([expect.any(String)]) },
    });
    expect(result.executed[0]?.artifact.data).toMatchObject({
      schemaVersion: "quad.connector_execution.v1",
      dryRun: false,
      connector: { mode: "approved_execution", writeIntent: "execute_approved_artifact" },
      action: {
        executed: true,
        autonomy: {
          tier: "tier_3_approve",
          label: "explicit approve",
          submitsExternally: true,
        },
      },
      proof: { sourceDraftHash: expect.stringMatching(/^fnv1a:/) },
      rollbackPlan: { steps: expect.arrayContaining([expect.any(String)]) },
      postExecutionVerification: { required: true, verifier: "quad.post_ship_verifier" },
    });
    expect(result.executed.every((item) => item.packet.type === "connector_action")).toBe(true);
    expect(result.browserActions.every((item) => item.packet.type === "connector_action")).toBe(true);
    expect(snapshot?.artifacts.filter((artifact) => artifact.kind === "connector_execution")).toHaveLength(3);
    expect(snapshot?.artifacts.filter((artifact) => artifact.kind === "browser_action")).toHaveLength(1);
    expect(snapshot?.receipts.filter((receipt) => receipt.status === "executed").length).toBeGreaterThanOrEqual(4);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.completed")).toHaveLength(6);
    expect(packets.length).toBeGreaterThanOrEqual(7);
    expect(verification.status).toBe("passed");
    expect(verification.items.filter((item) => item.artifactKind === "connector_execution")).toHaveLength(3);
    expect(verification.items.filter((item) => item.artifactKind === "browser_action")).toHaveLength(1);
    await expect(getEvidenceBundles({ orgId: "org_execute", runId: run.runId, kind: "browser_action" })).resolves.toHaveLength(2);
  });

  it("does not execute the same staged drafts twice", async () => {
    const run = createRunWithTrustPacket("run_execute_once");
    await decideWorkflowApproval({
      runId: run.runId,
      approvalId: run.approvalId,
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T00:00:03.000Z",
    });
    await dryRunPublish({
      runId: run.runId,
      orgId: "org_execute",
      now: "2026-06-21T00:00:04.000Z",
      env: publisherEnv(),
    });
    await executeApprovedPublish({
      runId: run.runId,
      orgId: "org_execute",
      now: "2026-06-21T00:00:05.000Z",
      env: publisherEnv(),
    });

    await expect(
      executeApprovedPublish({
        runId: run.runId,
        orgId: "org_execute",
        now: "2026-06-21T00:00:06.000Z",
        env: publisherEnv(),
      })
    ).rejects.toMatchObject({
      code: "already_executed",
      status: 409,
    } satisfies Partial<ApprovedPublishError>);
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
    orgId: "org_execute",
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
