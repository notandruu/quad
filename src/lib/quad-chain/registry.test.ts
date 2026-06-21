import { describe, expect, it } from "vitest";
import { createQuadChainPacket } from ".";
import { getLatestQuadChainPacket, getQuadChainPackets, saveQuadChainPacket } from "./registry";

describe("quad chain registry", () => {
  it("saves and retrieves packets through the in-memory fallback", async () => {
    const runId = `run_registry_${crypto.randomUUID()}`;
    const packet = createQuadChainPacket({
      type: "audit_event",
      orgId: "org_registry",
      runId,
      producer: "quad.test",
      consumer: "quad.test_receiver",
      sources: [{ id: "source_1", kind: "event", content: { message: "rendered page" } }],
      output: "rendered page with status 200",
      answerConcepts: ["rendered"],
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    const saved = await saveQuadChainPacket(packet);
    expect(saved.summary.accepted).toBe(true);

    const packets = await getQuadChainPackets({ orgId: "org_registry", runId });
    expect(packets.map((item) => item.id)).toContain(packet.id);

    const latest = await getLatestQuadChainPacket({ runId });
    expect(latest?.id).toBe(packet.id);
  });
});
