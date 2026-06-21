import { describe, expect, it, vi } from "vitest";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import type { BrainMemory } from "@/lib/types";
import { saveMemoryMetadata } from "./metadata";
import { proposeMemoryRefresh, MemoryRefreshError } from "./refresh";
import { findMemoryBySourceId } from "./retrieve";
import { addMemory, deleteMemoryStore } from "./store";

vi.mock("./db", () => ({
  getClient: vi.fn(() => null),
  ensureSchema: vi.fn(async () => undefined),
}));

describe("memory refresh proposals", () => {
  it("stages stale memory refreshes behind approval", async () => {
    const orgId = "org_memory_refresh";
    deleteMemoryStore({ orgId });
    addMemory(memory({
      id: "mem_refresh_stale",
      orgId,
      sourceId: "security_control_source",
      title: "Security control",
      updatedAt: "2026-06-01T00:00:00.000Z",
    }));
    saveMemoryMetadata("mem_refresh_stale", {
      visibility: "company",
      ownerUserId: null,
      teamIds: [],
      validationStatus: "approved",
      sourceUpdatedAt: "2026-06-01T00:00:00.000Z",
      staleAfter: "2026-06-10T00:00:00.000Z",
      freshness: "stale",
      relationships: [{ kind: "supports", sourceId: "control_a" }],
    });

    const proposal = await proposeMemoryRefresh({
      orgId,
      memoryId: "mem_refresh_stale",
      now: "2026-06-21T12:00:00.000Z",
      nextStaleAfter: "2026-07-21T12:00:00.000Z",
    });

    expect(proposal.mode).toBe("proposal");
    expect(proposal.task.status).toBe("needs_approval");
    expect(proposal.packet.accepted).toBe(true);
    expect(proposal.refresh).toMatchObject({
      originalMemoryId: "mem_refresh_stale",
      originalSourceId: "security_control_source",
      originalFreshness: "stale",
      refreshSourceId: "security_control_source:refresh:20260621",
      nextStaleAfter: "2026-07-21T12:00:00.000Z",
    });
    expect(await findMemoryBySourceId(orgId, proposal.refresh.refreshSourceId)).toBeNull();

    const approved = await decideWorkflowApproval({
      runId: proposal.runId,
      approvalId: proposal.approvalId,
      orgId,
      decision: "approved",
      approver: "operator",
      now: "2026-06-21T12:01:00.000Z",
    });
    const refreshed = await findMemoryBySourceId(orgId, proposal.refresh.refreshSourceId);

    expect(approved.receipt.status).toBe("executed");
    expect(refreshed?.title).toBe("Refresh: Security control");
    deleteMemoryStore({ orgId });
  });

  it("returns a typed not-found error for missing memory", async () => {
    await expect(proposeMemoryRefresh({
      orgId: "org_memory_refresh_missing",
      memoryId: "missing",
    })).rejects.toMatchObject({
      code: "memory_not_found",
      status: 404,
    } satisfies Partial<MemoryRefreshError>);
  });
});

function memory(input: {
  id: string;
  orgId: string;
  sourceId: string;
  title: string;
  updatedAt: string;
}): BrainMemory {
  return {
    id: input.id,
    orgId: input.orgId,
    sourceId: input.sourceId,
    sourceType: "manual",
    title: input.title,
    content: `${input.title} current approved content`,
    summary: `${input.title} current approved summary`,
    entities: ["security"],
    embedding: [],
    confidence: 0.92,
    permissions: ["scope:company"],
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    evidence: [{ quote: `${input.title} current approved content` }],
  };
}
