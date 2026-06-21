import { describe, expect, it, vi } from "vitest";
import { createQuadChainPacket } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import type { BrainMemory } from "@/lib/types";
import { buildScopedContextGraph, summarizeScopedContextGraph } from "./contextGraph";
import { saveMemoryMetadata } from "./metadata";
import { addMemory, deleteMemoryStore } from "./store";

vi.mock("./db", () => ({
  getClient: vi.fn(() => null),
}));

describe("scoped context graph", () => {
  it("builds a permission-scoped graph without exposing raw memory content", async () => {
    const orgId = "org_context_graph";
    deleteMemoryStore({ orgId });
    addMemory(memory({
      id: "mem_company_graph",
      orgId,
      sourceId: "source_company_graph",
      title: "Company policy",
      permissions: ["scope:company"],
      content: "secret raw company content should not leak",
      entities: ["hipaa"],
      updatedAt: "2026-06-21T10:00:00.000Z",
    }));
    addMemory(memory({
      id: "mem_team_graph",
      orgId,
      sourceId: "source_team_graph",
      title: "Security runbook",
      permissions: ["scope:team", "team:security"],
      content: "secret raw team content should not leak",
      entities: ["hipaa"],
      updatedAt: "2026-06-21T09:00:00.000Z",
    }));
    addMemory(memory({
      id: "mem_personal_graph",
      orgId,
      sourceId: "source_personal_graph",
      title: "Stephen note",
      permissions: ["scope:personal", "user:stephen"],
      content: "secret raw personal content should not leak",
      entities: ["donor"],
      updatedAt: "2026-06-21T08:00:00.000Z",
    }));
    saveMemoryMetadata("mem_company_graph", {
      visibility: "company",
      ownerUserId: null,
      teamIds: [],
      validationStatus: "approved",
      sourceUpdatedAt: "2026-06-21T10:00:00.000Z",
      staleAfter: "2026-07-21T10:00:00.000Z",
      freshness: "fresh",
      relationships: [{ kind: "supports", sourceId: "source_team_graph", label: "backs runbook" }],
    });
    saveMemoryMetadata("mem_team_graph", {
      visibility: "team",
      ownerUserId: null,
      teamIds: ["security"],
      validationStatus: "verified",
      sourceUpdatedAt: "2026-06-21T09:00:00.000Z",
      staleAfter: "2026-06-01T00:00:00.000Z",
      freshness: "stale",
      relationships: [],
    });
    saveMemoryMetadata("mem_personal_graph", {
      visibility: "personal",
      ownerUserId: "stephen",
      teamIds: [],
      validationStatus: "unverified",
      sourceUpdatedAt: "2026-06-21T08:00:00.000Z",
      staleAfter: null,
      freshness: "unknown",
      relationships: [],
    });
    await saveQuadChainPacket(createQuadChainPacket({
      type: "brain_memory_write",
      orgId,
      runId: "run_context_graph",
      producer: "test",
      consumer: "brain",
      sources: [{ id: "mem_company_graph", kind: "memory", content: "secret source body" }],
      evidence: [{ id: "ev_company", sourceId: "mem_company_graph", quote: "Company policy", required: true }],
      output: "Company policy",
      answerConcepts: ["company"],
    }));

    const companyOnly = await buildScopedContextGraph({ orgId, limit: 10 });
    const security = await buildScopedContextGraph({
      orgId,
      limit: 10,
      requester: { userId: "stephen", teamIds: ["security"], includePersonal: true },
    });
    const summary = summarizeScopedContextGraph(security);

    expect(companyOnly.counts).toMatchObject({
      total: 1,
      company: 1,
      team: 0,
      personal: 0,
    });
    expect(security.counts).toMatchObject({
      total: 3,
      company: 1,
      team: 1,
      personal: 1,
      stale: 1,
      verified: 1,
      approved: 1,
      withPackets: 1,
      edges: 1,
    });
    expect(security.edges[0]).toMatchObject({
      from: "memory:mem_company_graph",
      to: "memory:mem_team_graph",
      kind: "supports",
      resolved: true,
    });
    expect(summary.byVisibility).toEqual({ company: 1, team: 1, personal: 1 });
    expect(summary.latest[0].packetId).toMatch(/^qpacket_/);
    expect(JSON.stringify(security)).not.toContain("secret raw");
    expect(JSON.stringify(summary)).not.toContain("secret source body");

    deleteMemoryStore({ orgId });
  });
});

function memory(input: {
  id: string;
  orgId: string;
  sourceId: string;
  title: string;
  permissions: string[];
  content: string;
  entities: string[];
  updatedAt: string;
}): BrainMemory {
  return {
    id: input.id,
    orgId: input.orgId,
    sourceId: input.sourceId,
    sourceType: "manual",
    title: input.title,
    content: input.content,
    summary: `${input.title} summary`,
    entities: input.entities,
    embedding: [],
    confidence: 0.9,
    permissions: input.permissions,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    evidence: [{ quote: input.content }],
  };
}
