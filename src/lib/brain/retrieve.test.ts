import { describe, expect, it, vi } from "vitest";
import { addMemory, deleteMemoryStore } from "./store";
import { retrieveMemories, retrieveMemoriesWithPackets } from "./retrieve";
import { ingestMemoryWithReceipt } from "./ingest";
import { createQuadChainPacket } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";

vi.mock("./db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("retrieveMemoriesWithPackets", () => {
  it("returns the latest brain memory write packet with retrieved memory", async () => {
    const orgId = "org_retrieve_packets";
    deleteMemoryStore({ orgId });
    addMemory({
      id: "mem_verified_voice",
      orgId,
      sourceId: "voice_1",
      sourceType: "meeting",
      title: "Voice fact",
      content: "The company completed SOC 2 Type II.",
      summary: "SOC 2 Type II complete.",
      entities: [],
      embedding: [],
      confidence: 0.92,
      permissions: ["internal"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: [{ quote: "completed SOC 2 Type II" }],
    });

    const packet = createQuadChainPacket({
      type: "brain_memory_write",
      orgId,
      runId: "voice_1",
      producer: "quad.company_brain",
      consumer: "quad.retrieval",
      sources: [
        {
          id: "mem_verified_voice",
          kind: "memory",
          content: { title: "Voice fact" },
        },
      ],
      evidence: [
        {
          id: "ev_1",
          sourceId: "mem_verified_voice",
          quote: "completed SOC 2 Type II",
          required: true,
        },
      ],
      output: "brain memory write: Voice fact\nevidence: completed SOC 2 Type II",
      answerConcepts: ["memory", "write"],
      visibility: "restricted",
    });
    await saveQuadChainPacket(packet);

    const [result] = await retrieveMemoriesWithPackets({
      orgId,
      query: "soc 2",
      limit: 1,
    });

    expect(result.memory.id).toBe("mem_verified_voice");
    expect(result.quadChain?.type).toBe("brain_memory_write");
    expect(result.quadChain?.accepted).toBe(true);

    deleteMemoryStore({ orgId });
  });

  it("filters team and personal memories by requester context", async () => {
    const orgId = "org_retrieve_permissions";
    deleteMemoryStore({ orgId });
    addMemory(memory({
      id: "mem_company",
      orgId,
      sourceId: "company_1",
      title: "Company memory",
      content: "Shared deployment policy.",
      permissions: ["scope:company"],
    }));
    addMemory(memory({
      id: "mem_team_security",
      orgId,
      sourceId: "team_1",
      title: "Security team memory",
      content: "Security team keeps the private incident runbook.",
      permissions: ["scope:team", "team:security"],
    }));
    addMemory(memory({
      id: "mem_personal_maddy",
      orgId,
      sourceId: "personal_1",
      title: "Maddy personal memory",
      content: "Maddy prefers storyboard notes in the morning.",
      permissions: ["scope:personal", "user:maddy"],
    }));

    const anonymous = await retrieveMemories({ orgId, query: "policy runbook storyboard", limit: 10 });
    const security = await retrieveMemories({
      orgId,
      query: "policy runbook storyboard",
      limit: 10,
      requester: { teamIds: ["security"] },
    });
    const maddy = await retrieveMemories({
      orgId,
      query: "policy runbook storyboard",
      limit: 10,
      requester: { userId: "maddy", includePersonal: true },
    });

    expect(anonymous.map((item) => item.id)).toEqual(["mem_company"]);
    expect(security.map((item) => item.id)).toEqual(expect.arrayContaining(["mem_company", "mem_team_security"]));
    expect(security.map((item) => item.id)).not.toContain("mem_personal_maddy");
    expect(maddy.map((item) => item.id)).toEqual(expect.arrayContaining(["mem_company", "mem_personal_maddy"]));
    expect(maddy.map((item) => item.id)).not.toContain("mem_team_security");

    deleteMemoryStore({ orgId });
  });

  it("returns sidecar metadata for retrieved memories", async () => {
    const orgId = "org_retrieve_metadata";
    deleteMemoryStore({ orgId });
    await ingestMemoryWithReceipt({
      orgId,
      sourceId: "policy_metadata_1",
      sourceType: "doc",
      title: "Access policy",
      content: "Access reviews happen every quarter.",
      summary: "Quarterly access reviews.",
      permissions: ["internal"],
      staleAfter: "2026-06-20T00:00:00.000Z",
      sourceUpdatedAt: "2026-06-01T00:00:00.000Z",
      relationships: [{ kind: "supports", sourceId: "control_access_review" }],
    });

    const [result] = await retrieveMemoriesWithPackets({
      orgId,
      query: "access reviews",
      limit: 1,
    });

    expect(result.memory.sourceId).toBe("policy_metadata_1");
    expect(result.metadata).toMatchObject({
      visibility: "company",
      validationStatus: "approved",
      freshness: "stale",
      sourceUpdatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result.metadata.relationships).toEqual([
      { kind: "supports", sourceId: "control_access_review" },
    ]);

    deleteMemoryStore({ orgId });
  });
});

function memory(input: {
  id: string;
  orgId: string;
  sourceId: string;
  title: string;
  content: string;
  permissions: string[];
}) {
  const now = new Date().toISOString();
  return {
    sourceType: "manual" as const,
    summary: input.content,
    entities: [],
    embedding: [],
    confidence: 0.8,
    createdAt: now,
    updatedAt: now,
    evidence: [],
    ...input,
  };
}
