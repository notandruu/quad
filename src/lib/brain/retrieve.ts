import type { BrainMemory, BrainScope } from "@/lib/types";
import { INTERNAL_SOURCE_TYPES, EXTERNAL_SOURCE_TYPES } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { getClient } from "./db";
import { embed, cosineSimilarity } from "./embeddings";
import { seedMemories } from "./store";
import { getLatestQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { filterReadableMemories, canReadMemory, type BrainMemoryRequester } from "./permissions";

export type RetrieveOptions = {
  orgId: string;
  query: string;
  scope?: BrainScope;
  limit?: number;
  requester?: BrainMemoryRequester;
};

export type RetrievedMemoryWithPacket = {
  memory: BrainMemory;
  quadChain: QuadChainPacketSummary | null;
};

/**
 * Retrieve the most relevant company memories for a query. Uses pgvector via
 * Supabase RPC when configured, otherwise ranks the in-memory seed store so
 * the demo runs without any database.
 */
export async function retrieveMemories(
  opts: RetrieveOptions
): Promise<BrainMemory[]> {
  const { orgId, query, scope, limit = 8 } = opts;

  return traced(SPAN.brainRetrieve, { "org.id": orgId, scope: scope ?? "all", limit }, async () => {
    const queryEmbedding = await embed(query);
    const db = getClient();

    if (db) {
      const types = scopeToTypes(scope);
      const { data, error } = await db.rpc("match_memories", {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        org_id: orgId,
        source_types: types ?? null,
        match_count: limit * 3,
      });

      if (error) throw new Error(`Brain retrieve failed: ${error.message}`);
      return filterReadableMemories<BrainMemory>((data ?? []).map(rowToMemory), opts.requester).slice(0, limit);
    }

    // In-memory fallback over seed data.
    const types = scopeToTypes(scope);
    return seedMemories
      .filter((m) => m.orgId === orgId)
      .filter((m) => !types || types.includes(m.sourceType))
      .filter((m) => canReadMemory(m, opts.requester).readable)
      .map((m) => ({ m, score: cosineSimilarity(queryEmbedding, m.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ m }) => m);
  });
}

export async function retrieveMemoriesWithPackets(
  opts: RetrieveOptions
): Promise<RetrievedMemoryWithPacket[]> {
  const memories = await retrieveMemories(opts);
  return Promise.all(
    memories.map(async (memory) => {
      const packet = await getLatestQuadChainPacket({
        orgId: memory.orgId,
        sourceId: memory.id,
        type: "brain_memory_write",
      });
      return {
        memory,
        quadChain: packet ? summarizeQuadChainPacket(packet) : null,
      };
    })
  );
}

/**
 * Look up a single memory by its stable (orgId, sourceId). Used for idempotent
 * writeback: if a fact was already learned for a question, we reuse it rather
 * than writing a duplicate. Queries Supabase when configured, otherwise the
 * in-memory seed store — so the lookup hits whichever store the write went to.
 */
export async function findMemoryBySourceId(
  orgId: string,
  sourceId: string,
  requester?: BrainMemoryRequester
): Promise<BrainMemory | null> {
  const db = getClient();
  if (db) {
    const { data, error } = await db
      .from("brain_memory")
      .select("*")
      .eq("org_id", orgId)
      .eq("source_id", sourceId)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const memory = rowToMemory(data);
    return canReadMemory(memory, requester).readable ? memory : null;
  }
  const found = seedMemories.find((m) => m.orgId === orgId && m.sourceId === sourceId);
  if (!found || !canReadMemory(found, requester).readable) return null;
  return { ...found };
}

function scopeToTypes(scope?: BrainScope): string[] | null {
  if (scope === "internal") return [...INTERNAL_SOURCE_TYPES];
  if (scope === "external") return [...EXTERNAL_SOURCE_TYPES];
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToMemory(row: any): BrainMemory {
  return {
    id: row.id,
    orgId: row.org_id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    title: row.title,
    content: row.content,
    summary: row.summary ?? undefined,
    entities: row.entities ?? [],
    embedding: [],
    confidence: row.confidence,
    permissions: row.permissions ?? [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    evidence: row.evidence ?? [],
  };
}
