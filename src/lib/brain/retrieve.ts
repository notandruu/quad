import type { BrainMemory, BrainScope } from "@/lib/types";
import {
  INTERNAL_SOURCE_TYPES,
  EXTERNAL_SOURCE_TYPES,
} from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { getPool } from "./db";
import { embed, cosineSimilarity } from "./embeddings";
import { seedMemories } from "./store";

export type RetrieveOptions = {
  orgId: string;
  query: string;
  scope?: BrainScope;
  limit?: number;
};

/**
 * Retrieve the most relevant company memories for a query. Uses pgvector when
 * a database is configured, otherwise ranks the in-memory seed store so the
 * demo runs without Postgres.
 */
export async function retrieveMemories(
  opts: RetrieveOptions
): Promise<BrainMemory[]> {
  const { orgId, query, scope, limit = 8 } = opts;

  return traced(SPAN.brainRetrieve, { "org.id": orgId, scope: scope ?? "all", limit }, async () => {
    const queryEmbedding = await embed(query);
    const pool = getPool();

    if (pool) {
      const types = scopeToTypes(scope);
      const typeFilter = types ? "AND source_type = ANY($3)" : "";
      const params: unknown[] = [orgId, vectorLiteral(queryEmbedding)];
      if (types) params.push(types);

      const { rows } = await pool.query(
        `SELECT * FROM brain_memory
         WHERE org_id = $1 ${typeFilter}
         ORDER BY embedding <=> $2
         LIMIT ${limit}`,
        params
      );
      return rows.map(rowToMemory);
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

function scopeToTypes(scope?: BrainScope) {
  if (scope === "internal") return INTERNAL_SOURCE_TYPES;
  if (scope === "external") return EXTERNAL_SOURCE_TYPES;
  return null;
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
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
