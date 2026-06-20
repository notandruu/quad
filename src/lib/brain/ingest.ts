import type { BrainMemory, SourceType, BrainEvidence } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { getPool, ensureSchema } from "./db";
import { embed } from "./embeddings";
import { addMemory } from "./store";

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

/**
 * Persist a new memory into the company brain: embed the content, then write
 * to pgvector (or the in-memory seed store as a fallback).
 */
export async function ingestMemory(input: IngestInput): Promise<BrainMemory> {
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

    const pool = getPool();
    if (pool) {
      await pool.query(
        `INSERT INTO brain_memory
          (id, org_id, source_id, source_type, title, content, summary,
           entities, embedding, confidence, permissions, evidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          memory.id,
          memory.orgId,
          memory.sourceId,
          memory.sourceType,
          memory.title,
          memory.content,
          memory.summary ?? null,
          memory.entities,
          `[${embedding.join(",")}]`,
          memory.confidence,
          memory.permissions,
          JSON.stringify(memory.evidence),
        ]
      );
    } else {
      addMemory(memory);
    }

    return memory;
  });
}
