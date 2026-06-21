import type { BrainMemory, SourceType } from "@/lib/types";
import { getLatestQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { getClient } from "./db";
import { getMemoryMetadata, parseMemoryMetadata, type BrainMemoryMetadata, type BrainMemoryRelationshipKind } from "./metadata";
import { canReadMemory, type BrainMemoryRequester, type BrainMemoryVisibility } from "./permissions";
import { listMemoryStore } from "./store";

export type ContextGraphNode = {
  id: string;
  memoryId: string;
  sourceId: string;
  sourceType: SourceType;
  orgId: string;
  title: string;
  summary: string;
  visibility: BrainMemoryVisibility;
  validationStatus: BrainMemoryMetadata["validationStatus"];
  freshness: BrainMemoryMetadata["freshness"];
  confidence: number;
  entityCount: number;
  evidenceCount: number;
  relationshipCount: number;
  createdAt: string;
  updatedAt: string;
  latestPacket: QuadChainPacketSummary | null;
};

export type ContextGraphEdgeKind = BrainMemoryRelationshipKind | "shares_entity" | "source_evidence";

export type ContextGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: ContextGraphEdgeKind;
  label: string;
  resolved: boolean;
};

export type ScopedContextGraph = {
  orgId: string;
  generatedAt: string;
  requester: {
    userId: string | null;
    teamIds: string[];
    includePersonal: boolean;
  };
  counts: {
    total: number;
    company: number;
    team: number;
    personal: number;
    stale: number;
    verified: number;
    approved: number;
    withPackets: number;
    edges: number;
  };
  nodes: ContextGraphNode[];
  edges: ContextGraphEdge[];
  warnings: string[];
};

export type ScopedContextGraphSummary = {
  total: number;
  byVisibility: Record<BrainMemoryVisibility, number>;
  stale: number;
  verifiedOrApproved: number;
  withPackets: number;
  edges: number;
  warnings: string[];
  latest: Array<Pick<ContextGraphNode, "id" | "title" | "summary" | "visibility" | "freshness" | "validationStatus" | "updatedAt"> & {
    packetId: string | null;
  }>;
};

export async function buildScopedContextGraph(input: {
  orgId: string;
  requester?: BrainMemoryRequester;
  limit?: number;
  includeRelationshipEdges?: boolean;
}): Promise<ScopedContextGraph> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const requester = normalizeRequester(input.requester);
  const loaded = await loadGraphMemories(input.orgId, limit * 3);
  const readable = loaded
    .filter((memory) => canReadMemory(memory, requester).readable)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);

  const nodes = await Promise.all(readable.map(toGraphNode));
  const edges = input.includeRelationshipEdges === false ? [] : buildEdges(readable, nodes);
  const counts = countGraph(nodes, edges);

  return {
    orgId: input.orgId,
    generatedAt: new Date().toISOString(),
    requester,
    counts,
    nodes,
    edges,
    warnings: buildWarnings(nodes, edges),
  };
}

export function summarizeScopedContextGraph(graph: ScopedContextGraph): ScopedContextGraphSummary {
  return {
    total: graph.counts.total,
    byVisibility: {
      company: graph.counts.company,
      team: graph.counts.team,
      personal: graph.counts.personal,
    },
    stale: graph.counts.stale,
    verifiedOrApproved: graph.counts.verified + graph.counts.approved,
    withPackets: graph.counts.withPackets,
    edges: graph.counts.edges,
    warnings: graph.warnings,
    latest: graph.nodes.slice(0, 8).map((node) => ({
      id: node.id,
      title: node.title,
      summary: node.summary,
      visibility: node.visibility,
      freshness: node.freshness,
      validationStatus: node.validationStatus,
      updatedAt: node.updatedAt,
      packetId: node.latestPacket?.id ?? null,
    })),
  };
}

async function toGraphNode(memory: BrainMemory & { metadataRaw?: unknown }): Promise<ContextGraphNode> {
  const metadata = getMemoryMetadata(memory, memory.metadataRaw);
  const packet = await getLatestQuadChainPacket({
    orgId: memory.orgId,
    sourceId: memory.id,
    type: "brain_memory_write",
  });

  return {
    id: graphNodeId(memory.id),
    memoryId: memory.id,
    sourceId: memory.sourceId,
    sourceType: memory.sourceType,
    orgId: memory.orgId,
    title: memory.title,
    summary: summarizeMemory(memory),
    visibility: metadata.visibility,
    validationStatus: metadata.validationStatus,
    freshness: metadata.freshness,
    confidence: memory.confidence,
    entityCount: memory.entities.length,
    evidenceCount: memory.evidence.length,
    relationshipCount: metadata.relationships.length,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    latestPacket: packet ? summarizeQuadChainPacket(packet) : null,
  };
}

function buildEdges(
  memories: Array<BrainMemory & { metadataRaw?: unknown }>,
  nodes: ContextGraphNode[]
): ContextGraphEdge[] {
  const bySourceId = new Map(nodes.map((node) => [node.sourceId, node.id]));
  const byMemoryId = new Map(nodes.map((node) => [node.memoryId, node.id]));
  const edges: ContextGraphEdge[] = [];

  for (const memory of memories) {
    const from = graphNodeId(memory.id);
    const metadata = getMemoryMetadata(memory, memory.metadataRaw);
    for (const relationship of metadata.relationships) {
      const target = bySourceId.get(relationship.sourceId) ?? byMemoryId.get(relationship.sourceId);
      edges.push({
        id: `edge_${memory.id}_${relationship.kind}_${relationship.sourceId}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        from,
        to: target ?? `external:${relationship.sourceId}`,
        kind: relationship.kind,
        label: relationship.label ?? relationship.kind.replace(/_/g, " "),
        resolved: Boolean(target),
      });
    }
  }

  return dedupeEdges(edges);
}

function countGraph(nodes: ContextGraphNode[], edges: ContextGraphEdge[]): ScopedContextGraph["counts"] {
  return {
    total: nodes.length,
    company: nodes.filter((node) => node.visibility === "company").length,
    team: nodes.filter((node) => node.visibility === "team").length,
    personal: nodes.filter((node) => node.visibility === "personal").length,
    stale: nodes.filter((node) => node.freshness === "stale").length,
    verified: nodes.filter((node) => node.validationStatus === "verified").length,
    approved: nodes.filter((node) => node.validationStatus === "approved").length,
    withPackets: nodes.filter((node) => Boolean(node.latestPacket)).length,
    edges: edges.length,
  };
}

function buildWarnings(nodes: ContextGraphNode[], edges: ContextGraphEdge[]): string[] {
  const warnings: string[] = [];
  const unresolved = edges.filter((edge) => !edge.resolved).length;
  const stale = nodes.filter((node) => node.freshness === "stale").length;
  const unverified = nodes.filter((node) => node.validationStatus === "unverified").length;
  if (unresolved > 0) warnings.push(`${unresolved} relationship${unresolved === 1 ? "" : "s"} point outside the visible graph.`);
  if (stale > 0) warnings.push(`${stale} visible memor${stale === 1 ? "y is" : "ies are"} stale.`);
  if (unverified > 0) warnings.push(`${unverified} visible memor${unverified === 1 ? "y is" : "ies are"} unverified.`);
  return warnings;
}

async function loadGraphMemories(orgId: string, limit: number): Promise<Array<BrainMemory & { metadataRaw?: unknown }>> {
  const db = getClient();
  if (db) {
    try {
      const { data, error } = await db
        .from("brain_memory")
        .select("id, org_id, source_id, source_type, title, content, summary, entities, confidence, permissions, evidence, created_at, updated_at, memory_metadata")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (!error && data) return data.map(rowToMemory);
    } catch {
      // Zero-key demos and local tests fall through to the in-memory store.
    }
  }

  return listMemoryStore({ orgId });
}

function summarizeMemory(memory: BrainMemory): string {
  return normalizeText(memory.summary ?? memory.title);
}

function normalizeRequester(requester: BrainMemoryRequester = {}): ScopedContextGraph["requester"] {
  return {
    userId: requester.userId?.trim().toLowerCase() || null,
    teamIds: [...new Set((requester.teamIds ?? []).map((teamId) => teamId.trim().toLowerCase()).filter(Boolean))],
    includePersonal: requester.includePersonal === true,
  };
}

function graphNodeId(memoryId: string): string {
  return `memory:${memoryId}`;
}

function dedupeEdges(edges: ContextGraphEdge[]): ContextGraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToMemory(row: any): BrainMemory & { metadataRaw?: unknown } {
  const metadataRaw = parseMemoryMetadata(row.memory_metadata) ?? row.memory_metadata;
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
    metadataRaw,
  };
}
