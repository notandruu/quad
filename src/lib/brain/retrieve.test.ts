import { describe, expect, it, vi } from "vitest";
import { addMemory, deleteMemoryStore } from "./store";
import { retrieveMemoriesWithPackets } from "./retrieve";
import { createQuadChainPacket } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";

vi.mock("./db", () => ({
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
});
