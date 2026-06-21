import { describe, expect, it, vi } from "vitest";
import {
  addArtifact,
  createReceipt,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  transitionRun,
} from "@/lib/runs";
import { verifyPublishedWork } from "./verification";

describe("post-ship verification", () => {
  it("verifies staged connector artifacts and completes the run", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const run = createWorkflowRun({
      id: "run_verify_pass",
      orgId: "org_verify",
      workflowKind: "trust_packet",
      title: "Verify staged work",
      createdBy: "dashboard",
      targetUrl: "https://example.com",
      now: "2026-06-21T00:00:00.000Z",
    });
    const trustPacket = addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: "Trust packet",
      data: { targetUrl: "https://example.com" },
    });
    const approval = requestApproval({
      runId: run.id,
      artifactId: trustPacket.id,
      reason: "approve packet",
      evidenceVisible: true,
    });
    createReceipt({
      runId: run.id,
      artifactId: trustPacket.id,
      approvalId: approval.id,
      status: "ready",
      summary: "ready",
    });
    const cmsDraft = addArtifact({
      runId: run.id,
      kind: "cms_draft",
      title: "Cms proof block draft",
      data: {
        dryRun: true,
        targetUrl: "https://example.com",
        sectionTitle: "Proof",
        body: "Proof copy",
      },
    });
    createReceipt({
      runId: run.id,
      artifactId: cmsDraft.id,
      status: "ready",
      summary: "cms staged",
    });
    transitionRun(run.id, "needs_approval");
    await saveRunSnapshot(run.id);

    const result = await verifyPublishedWork({
      runId: run.id,
      orgId: "org_verify",
      now: "2026-06-21T01:00:00.000Z",
    });
    const snapshot = getRunSnapshot(run.id);

    expect(result.status).toBe("passed");
    expect(result.items).toHaveLength(1);
    expect(result.packets).toHaveLength(1);
    expect(result.task.status).toBe("completed");
    expect(snapshot?.artifacts.some((artifact) => artifact.kind === "verification_report")).toBe(true);
    expect(snapshot?.receipts.some((receipt) => receipt.status === "executed")).toBe(true);
  });

  it("rejects runs without staged connector artifacts", async () => {
    const run = createWorkflowRun({
      id: "run_verify_missing",
      orgId: "org_verify_missing",
      workflowKind: "trust_packet",
      title: "No staged work",
      createdBy: "dashboard",
    });

    await expect(verifyPublishedWork({
      runId: run.id,
      orgId: "org_verify_missing",
    })).rejects.toMatchObject({
      code: "artifact_missing",
      status: 404,
    });
  });
});
