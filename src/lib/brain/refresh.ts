import { getClient } from "./db";
import type { IngestInput } from "./ingest";
import { getMemoryMetadata, parseMemoryMetadata, saveMemoryMetadata, type BrainMemoryMetadata } from "./metadata";
import { canReadMemory, type BrainMemoryRequester } from "./permissions";
import { proposeMemoryWrite, type ProposeMemoryWriteResult } from "./proposals";
import { listMemoryStore } from "./store";
import type { BrainMemory } from "@/lib/types";

export class MemoryRefreshError extends Error {
  constructor(
    readonly code: "memory_not_found" | "memory_not_readable",
    message: string,
    readonly status: 404 | 403
  ) {
    super(message);
    this.name = "MemoryRefreshError";
  }
}

export type ProposeMemoryRefreshInput = {
  orgId: string;
  memoryId?: string;
  sourceId?: string;
  requestedBy?: "dashboard" | "agent" | "system";
  requester?: BrainMemoryRequester;
  reason?: string;
  now?: string;
  nextStaleAfter?: string;
};

export type ProposeMemoryRefreshResult = ProposeMemoryWriteResult & {
  refresh: {
    originalMemoryId: string;
    originalSourceId: string;
    originalFreshness: BrainMemoryMetadata["freshness"];
    refreshSourceId: string;
    nextStaleAfter: string;
  };
};

export async function proposeMemoryRefresh(input: ProposeMemoryRefreshInput): Promise<ProposeMemoryRefreshResult> {
  const now = input.now ?? new Date().toISOString();
  const memory = await findRefreshableMemory(input);
  if (!memory) {
    throw new MemoryRefreshError(
      "memory_not_found",
      "Memory was not found for this org, id, or source id.",
      404
    );
  }
  if (!canReadMemory(memory, input.requester).readable) {
    throw new MemoryRefreshError(
      "memory_not_readable",
      "Requester cannot refresh this memory scope.",
      403
    );
  }

  const metadata = getMemoryMetadata(memory, memory.metadataRaw, now);
  const nextStaleAfter = normalizeNextStaleAfter(input.nextStaleAfter, now);
  const refreshSourceId = buildRefreshSourceId(memory.sourceId, now);
  const proposalInput: IngestInput = {
    orgId: memory.orgId,
    sourceId: refreshSourceId,
    sourceType: memory.sourceType,
    title: `Refresh: ${memory.title}`,
    content: memory.content,
    summary: memory.summary ?? memory.content.slice(0, 240),
    entities: memory.entities,
    confidence: Math.min(memory.confidence, 0.85),
    permissions: memory.permissions,
    evidence: memory.evidence,
    visibility: metadata.visibility,
    ownerUserId: metadata.ownerUserId,
    teamIds: metadata.teamIds,
    validationStatus: "verified",
    sourceUpdatedAt: now,
    staleAfter: nextStaleAfter,
    relationships: [
      ...metadata.relationships,
      {
        kind: "updates",
        sourceId: memory.sourceId,
        label: "operator refresh proposal",
      },
      {
        kind: "derived_from",
        sourceId: memory.id,
        label: "previous memory record",
      },
    ],
  };

  const proposal = await proposeMemoryWrite({
    ...proposalInput,
    requestedBy: input.requestedBy ?? "dashboard",
    reason: input.reason ?? `Refresh stale memory before agents reuse ${memory.title}.`,
    now,
  });

  return {
    ...proposal,
    refresh: {
      originalMemoryId: memory.id,
      originalSourceId: memory.sourceId,
      originalFreshness: metadata.freshness,
      refreshSourceId,
      nextStaleAfter,
    },
  };
}

async function findRefreshableMemory(input: ProposeMemoryRefreshInput): Promise<(BrainMemory & { metadataRaw?: unknown }) | null> {
  const db = getClient();
  if (db) {
    let query = db
      .from("brain_memory")
      .select("id, org_id, source_id, source_type, title, content, summary, entities, confidence, permissions, evidence, created_at, updated_at, memory_metadata")
      .eq("org_id", input.orgId);

    if (input.memoryId) {
      query = query.eq("id", input.memoryId);
    } else if (input.sourceId) {
      query = query.eq("source_id", input.sourceId);
    } else {
      return null;
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (!error && data) return rowToMemory(data);
  }

  const memory = listMemoryStore({ orgId: input.orgId, sourceId: input.sourceId })
    .find((item) => input.memoryId ? item.id === input.memoryId : true);
  return memory ? { ...memory } : null;
}

function buildRefreshSourceId(sourceId: string, now: string): string {
  const day = now.slice(0, 10).replace(/-/g, "");
  const safeSource = sourceId.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
  return `${safeSource}:refresh:${day}`;
}

function normalizeNextStaleAfter(value: string | undefined, now: string): string {
  const explicit = Date.parse(value ?? "");
  if (Number.isFinite(explicit)) return new Date(explicit).toISOString();
  const nowMs = Date.parse(now);
  const base = Number.isFinite(nowMs) ? nowMs : Date.now();
  return new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
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
  if (metadata) {
    saveMemoryMetadata(memory.id, metadata);
    memory.metadataRaw = metadata;
  }
  return memory;
}
