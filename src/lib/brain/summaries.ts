import type { BrainMemory, SourceType } from "@/lib/types";
import { getClient } from "./db";
import { getMemoryMetadata, parseMemoryMetadata, type BrainMemoryMetadata } from "./metadata";
import { canReadMemory, type BrainMemoryRequester } from "./permissions";
import { listMemoryStore } from "./store";

export type BrainMemoryTrailItem = {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  title: string;
  summary: string;
  confidence: number;
  updatedAt: string;
  evidenceCount: number;
  metadata: BrainMemoryMetadata;
};

export type BrainMemoryTrailSummary = {
  total: number;
  shown: number;
  stale: number;
  fresh: number;
  unknownFreshness: number;
  company: number;
  team: number;
  personal: number;
  relationshipCount: number;
  latest: BrainMemoryTrailItem[];
};

export async function listBrainMemoryTrail(input: {
  orgId: string;
  limit?: number;
  requester?: BrainMemoryRequester;
}): Promise<BrainMemoryTrailSummary> {
  const limit = Math.max(1, Math.min(input.limit ?? 8, 25));
  const memories = await loadMemories(input.orgId, limit * 3);
  const readable = memories.filter((memory) => canReadMemory(memory, input.requester).readable);
  const latest = readable
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map(toTrailItem);

  return {
    total: readable.length,
    shown: latest.length,
    stale: latest.filter((item) => item.metadata.freshness === "stale").length,
    fresh: latest.filter((item) => item.metadata.freshness === "fresh").length,
    unknownFreshness: latest.filter((item) => item.metadata.freshness === "unknown").length,
    company: latest.filter((item) => item.metadata.visibility === "company").length,
    team: latest.filter((item) => item.metadata.visibility === "team").length,
    personal: latest.filter((item) => item.metadata.visibility === "personal").length,
    relationshipCount: latest.reduce((sum, item) => sum + item.metadata.relationships.length, 0),
    latest,
  };
}

async function loadMemories(orgId: string, limit: number): Promise<Array<BrainMemory & { metadataRaw?: unknown }>> {
  const db = getClient();
  if (db) {
    const { data, error } = await db
      .from("brain_memory")
      .select("id, org_id, source_id, source_type, title, content, summary, entities, confidence, permissions, evidence, created_at, updated_at, memory_metadata")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!error && data) return data.map(rowToMemory);
  }

  return listMemoryStore({ orgId });
}

function toTrailItem(memory: BrainMemory & { metadataRaw?: unknown }): BrainMemoryTrailItem {
  return {
    id: memory.id,
    sourceId: memory.sourceId,
    sourceType: memory.sourceType,
    title: memory.title,
    summary: memory.summary ?? memory.content.slice(0, 180),
    confidence: memory.confidence,
    updatedAt: memory.updatedAt,
    evidenceCount: memory.evidence.length,
    metadata: getMemoryMetadata(memory, memory.metadataRaw),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToMemory(row: any): BrainMemory & { metadataRaw?: unknown } {
  const memory: BrainMemory & { metadataRaw?: unknown } = {
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
    metadataRaw: row.memory_metadata,
  };
  const metadata = parseMemoryMetadata(row.memory_metadata);
  if (metadata) memory.metadataRaw = metadata;
  return memory;
}
