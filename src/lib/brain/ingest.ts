import type { BrainMemory, SourceType, BrainEvidence } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { getClient, ensureSchema } from "./db";
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
 * to Supabase (or the in-memory seed store as a fallback).
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

    return memory;
  });
}
