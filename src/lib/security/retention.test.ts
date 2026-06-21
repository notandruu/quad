import { describe, expect, it, vi } from "vitest";
import { addMemory } from "@/lib/brain";
import { enqueueAuditJob, listJobs } from "@/lib/jobs/queue";
import { createQuadChainPacket } from "@/lib/quad-chain";
import { getQuadChainPackets, saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { listRunSnapshots } from "@/lib/runs";
import type { BrainMemory } from "@/lib/types";
import { buildDataDeletionReceipt, confirmationFor } from "./retention";

describe("data retention deletion receipts", () => {
  it("dry-runs org deletion without deleting fallback data", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const orgId = "org_delete_dry";
    const runId = "run_delete_dry";
    await enqueueAuditJob({
      orgId,
      runId,
      targetUrl: "https://example.com",
    });
    addMemory(memory({ orgId, sourceId: "source_delete_dry" }));
    await saveQuadChainPacket(packet({ orgId, runId }));

    const receipt = await buildDataDeletionReceipt({
      orgId,
      scope: "org",
      mode: "dry_run",
      requestedBy: "test",
      now: "2026-06-21T00:00:00.000Z",
    });

    expect(receipt.executed).toBe(false);
    expect(receipt.requiredConfirmation).toBe(`delete:${orgId}`);
    expect(receipt.stores.find((store) => store.store === "workflow_runs")?.matched).toBeGreaterThanOrEqual(1);
    expect(receipt.stores.find((store) => store.store === "jobs")?.matched).toBeGreaterThanOrEqual(1);
    expect(receipt.stores.find((store) => store.store === "brain_memories")?.matched).toBeGreaterThanOrEqual(1);
    expect((await listRunSnapshots({ orgId })).length).toBeGreaterThanOrEqual(1);
  });

  it("requires explicit confirmation before execution", async () => {
    await expect(buildDataDeletionReceipt({
      orgId: "org_delete_confirm",
      scope: "org",
      mode: "execute",
      confirmation: "delete:wrong",
    })).rejects.toMatchObject({
      code: "confirmation_required",
      status: 409,
    });
  });

  it("executes run-scoped deletion across run, job, and packet stores", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const orgId = "org_delete_run";
    const runId = "run_delete_execute";
    await enqueueAuditJob({
      orgId,
      runId,
      targetUrl: "https://example.org",
    });
    await saveQuadChainPacket(packet({ orgId, runId }));

    const receipt = await buildDataDeletionReceipt({
      orgId,
      scope: "run",
      mode: "execute",
      runId,
      confirmation: confirmationFor({ orgId, scope: "run", runId }),
    });

    expect(receipt.executed).toBe(true);
    expect(receipt.stores.find((store) => store.store === "workflow_runs")?.deleted).toBeGreaterThanOrEqual(1);
    expect(receipt.stores.find((store) => store.store === "jobs")?.deleted).toBeGreaterThanOrEqual(1);
    expect(receipt.stores.find((store) => store.store === "quadchain_packets")?.deleted).toBeGreaterThanOrEqual(1);
    expect(await listRunSnapshots({ orgId })).toEqual([]);
    expect(await listJobs({ orgId })).toEqual([]);
    expect(await getQuadChainPackets({ orgId, runId })).toEqual([]);
  });
});

function memory(input: { orgId: string; sourceId: string }): BrainMemory {
  return {
    id: `memory_${input.sourceId}`,
    orgId: input.orgId,
    sourceId: input.sourceId,
    sourceType: "manual",
    title: "Deletion test memory",
    content: "Deletion test content",
    entities: [],
    embedding: [0, 1, 0],
    confidence: 0.8,
    permissions: [],
    evidence: [],
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
  };
}

function packet(input: { orgId: string; runId: string }) {
  return createQuadChainPacket({
    type: "trust_packet",
    orgId: input.orgId,
    runId: input.runId,
    producer: "test",
    consumer: "test",
    sources: [
      {
        id: "source_delete_packet",
        kind: "memory",
        content: "required evidence",
      },
    ],
    evidence: [
      {
        id: "evidence_delete_packet",
        sourceId: "source_delete_packet",
        quote: "required evidence",
        required: true,
      },
    ],
    output: "required evidence",
    answerConcepts: ["required evidence"],
  });
}
