import { describe, expect, it, vi } from "vitest";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { getRunSnapshot } from "@/lib/runs";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { findMemoryBySourceId } from "./retrieve";
import { proposeMemoryWrite } from "./proposals";

vi.mock("./db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("memory write proposals", () => {
  it("stages shared brain writes behind approval and commits after approval", async () => {
    const proposal = await proposeMemoryWrite({
      orgId: "org_memory_approval",
      sourceId: "manual_memory_approval_1",
      sourceType: "manual",
      title: "New compliance control",
      content: "Quad keeps raw customer data out of shared telemetry.",
      summary: "Raw customer data is not logged to shared telemetry.",
      permissions: ["internal"],
      evidence: [{ quote: "raw customer data out of shared telemetry" }],
      now: "2026-06-21T12:00:00.000Z",
    });

    expect(proposal.mode).toBe("proposal");
    expect(proposal.task.status).toBe("needs_approval");
    expect(proposal.receipt.status).toBe("blocked");
    expect(proposal.packet.type).toBe("approval");
    expect(proposal.packet.accepted).toBe(true);
    expect(await findMemoryBySourceId("org_memory_approval", "manual_memory_approval_1")).toBeNull();

    const approved = await decideWorkflowApproval({
      runId: proposal.runId,
      approvalId: proposal.approvalId,
      orgId: "org_memory_approval",
      decision: "approved",
      approver: "stephen",
      now: "2026-06-21T12:01:00.000Z",
    });

    const snapshot = getRunSnapshot(proposal.runId);
    const memory = await findMemoryBySourceId("org_memory_approval", "manual_memory_approval_1");
    const packets = await getQuadChainPackets({
      orgId: "org_memory_approval",
      type: "brain_memory_write",
    });

    expect(approved.receipt.status).toBe("executed");
    expect(approved.packet.accepted).toBe(true);
    expect(approved.sideEffect).toMatchObject({
      kind: "brain_memory_write",
      memoryId: memory?.id,
    });
    expect(memory?.title).toBe("New compliance control");
    expect(snapshot?.run.status).toBe("completed");
    expect(packets.some((packet) => packet.sources.some((source) => source.id === memory?.id))).toBe(true);
  });
});
