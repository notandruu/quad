import type { BrainMemory, SourceType, BrainEvidence } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { getClient, ensureSchema } from "./db";
import { embed } from "./embeddings";
import { addMemory } from "./store";
import { createQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";

export type IngestInput = {
  orgId: string;
  sourceId: string;
  sourceType: SourceType;
  title: string;
  content: string;
  summary?: string;
  entities?: string[];
  confidence?: number;
  permissions?: string[];
  evidence?: BrainEvidence[];
};

export type IngestMemoryResult = {
  memory: BrainMemory;
  quadChain: QuadChainPacketSummary;
};

/**
 * Persist a new memory into the company brain: embed the content, then write
 * to Supabase (or the in-memory seed store as a fallback).
 */
export async function ingestMemory(input: IngestInput): Promise<BrainMemory> {
  const result = await ingestMemoryWithReceipt(input);
  return result.memory;
}

export async function ingestMemoryWithReceipt(input: IngestInput): Promise<IngestMemoryResult> {
  return traced(SPAN.memoryWrite, { "org.id": input.orgId, "source.type": input.sourceType }, async () => {
    await ensureSchema();
    const now = new Date().toISOString();
    const embedding = await embed(`${input.title}\n${input.content}`);

    const memory: BrainMemory = {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      title: input.title,
      content: input.content,
      summary: input.summary,
      entities: input.entities ?? [],
      embedding,
      confidence: input.confidence ?? 0.6,
      permissions: input.permissions ?? [],
      createdAt: now,
      updatedAt: now,
      evidence: input.evidence ?? [],
    };

    const db = getClient();
    if (db) {
      const { error } = await db.from("brain_memory").insert({
        id: memory.id,
        org_id: memory.orgId,
        source_id: memory.sourceId,
        source_type: memory.sourceType,
        title: memory.title,
        content: memory.content,
        summary: memory.summary ?? null,
        entities: memory.entities,
        embedding: `[${embedding.join(",")}]`,
        confidence: memory.confidence,
        permissions: memory.permissions,
        evidence: memory.evidence,
      });
      if (error) throw new Error(`Brain ingest failed: ${error.message}`);
    } else {
      addMemory(memory);
    }

    const evidenceQuotes = memory.evidence
      .filter((item) => Boolean(item.quote))
      .slice(0, 6)
      .map((item) => item.quote as string);
    const output = [
      `brain memory write: ${memory.title}`,
      `source type: ${memory.sourceType}`,
      `summary: ${memory.summary ?? memory.content.slice(0, 240)}`,
      ...evidenceQuotes.map((quote) => `evidence: ${quote}`),
    ].join("\n");
    const savedPacket = await saveQuadChainPacket(createQuadChainPacket({
      type: "brain_memory_write",
      orgId: memory.orgId,
      runId: input.sourceId,
      producer: "quad.company_brain",
      consumer: "quad.retrieval",
      sources: [
        {
          id: memory.id,
          kind: "memory",
          content: {
            sourceId: memory.sourceId,
            sourceType: memory.sourceType,
            title: memory.title,
            summary: memory.summary,
            evidence: memory.evidence,
            permissions: memory.permissions,
          },
        },
      ],
      evidence: evidenceQuotes
        .map((quote, index) => ({
          id: `${memory.id}:evidence_${index + 1}`,
          sourceId: memory.id,
          quote,
          required: true,
        })),
      output,
      answerConcepts: ["memory", "write"],
      visibility: "restricted",
    }));

    return { memory, quadChain: savedPacket.summary };
  });
}
