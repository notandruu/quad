import type { BrainMemory, BrainScope } from "@/lib/types";
import { INTERNAL_SOURCE_TYPES, EXTERNAL_SOURCE_TYPES } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { getClient } from "./db";
import { embed, cosineSimilarity } from "./embeddings";
import { seedMemories } from "./store";

export type RetrieveOptions = {
  orgId: string;
  query: string;
  scope?: BrainScope;
  limit?: number;
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
        match_count: limit,
      });

      if (error) throw new Error(`Brain retrieve failed: ${error.message}`);
      return (data ?? []).map(rowToMemory);
    }

    // In-memory fallback over seed data.
    const types = scopeToTypes(scope);
    return seedMemories
      .filter((m) => m.orgId === orgId)
      .filter((m) => !types || types.includes(m.sourceType))
      .map((m) => ({ m, score: cosineSimilarity(queryEmbedding, m.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ m }) => m);
  });
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
