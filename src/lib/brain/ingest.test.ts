import { describe, expect, it, vi } from "vitest";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { ingestMemoryWithReceipt } from "./ingest";

vi.mock("./db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("ingestMemoryWithReceipt", () => {
  it("persists memory and returns a brain memory write packet summary", async () => {
    const result = await ingestMemoryWithReceipt({
      orgId: "org_voice_test",
      sourceId: "voice_run_1",
      sourceType: "meeting",
      title: "Voice-captured company context",
      content: "Our SOC 2 audit is complete and the website should mention it.",
      summary: "SOC 2 audit complete.",
      evidence: [{ quote: "Our SOC 2 audit is complete" }],
      permissions: ["internal"],
    });

    expect(result.memory.sourceType).toBe("meeting");
    expect(result.quadChain.type).toBe("brain_memory_write");
    expect(result.quadChain.accepted).toBe(true);
    expect(result.quadChain.evidenceRequired).toBe(1);

    const packets = await getQuadChainPackets({
      orgId: "org_voice_test",
      runId: "voice_run_1",
      type: "brain_memory_write",
    });
    expect(packets).toHaveLength(1);
  });
});
