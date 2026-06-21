import { describe, expect, it } from "vitest";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { getRunSnapshot, summarizeTaskStream } from "@/lib/runs";
import { createCapabilityInstallRequest } from "./installRequest";

describe("capability install requests", () => {
  it("creates an approval-backed run for a starter bundle request", async () => {
    const result = await createCapabilityInstallRequest({
      orgId: "org_install_request",
      actor: "operator.test",
      includeWriteTools: true,
      env: {
        QUAD_CAPABILITY_ALLOWLIST: "quad.chain_verifier",
        CMS_API_KEY: "cms_test",
      },
      now: "2026-06-21T00:00:00.000Z",
    });

    const snapshot = getRunSnapshot(result.runId);
    expect(snapshot?.run.workflowKind).toBe("capability_install");
    expect(snapshot?.run.status).toBe("needs_approval");
    expect(snapshot?.artifacts[0]).toMatchObject({
      kind: "approval_request",
      title: "Enterprise proof starter install plan",
    });
    expect(snapshot?.approvals[0]).toMatchObject({
      id: result.approvalId,
      decision: "pending",
      evidenceVisible: true,
    });
    expect(snapshot?.receipts[0].status).toBe("blocked");
    expect(result.packet).toMatchObject({
      type: "connector_action",
      orgId: "org_install_request",
      runId: result.runId,
      accepted: true,
      evidenceRequired: 2,
      evidencePreserved: 2,
    });
    expect(result.plan.newlyForceInstalled).toEqual(expect.arrayContaining(["cms.publisher", "task.publisher"]));
    expect(result.task.nextAction).toBe("Human approval required before customer-facing work can ship.");
    expect(summarizeTaskStream(snapshot!).map((event) => event.kind)).toEqual(
      expect.arrayContaining(["run.created", "task.blocked", "approval.requested", "receipt.created"])
    );
    const packets = await getQuadChainPackets({
      orgId: "org_install_request",
      runId: result.runId,
      type: "connector_action",
    });
    expect(packets).toHaveLength(1);
    expect(JSON.stringify(packets[0])).not.toContain("cms_test");
  });
});
