import { describe, expect, it, vi } from "vitest";
import { addMemory, deleteMemoryStore } from "./store";
import { listBrainMemoryTrail } from "./summaries";
import { saveMemoryMetadata } from "./metadata";
import type { BrainMemory } from "@/lib/types";

vi.mock("./db", () => ({
  getClient: vi.fn(() => null),
}));

describe("brain memory trail summaries", () => {
  it("summarizes freshness, scopes, and relationships for operator surfaces", async () => {
    const orgId = "org_memory_trail";
    deleteMemoryStore({ orgId });
    addMemory(memory({
      id: "mem_company_fresh",
      orgId,
      title: "Company control",
      permissions: ["scope:company"],
      updatedAt: "2026-06-21T00:00:00.000Z",
    }));
    saveMemoryMetadata("mem_company_fresh", {
      visibility: "company",
      ownerUserId: null,
      teamIds: [],
      validationStatus: "approved",
      sourceUpdatedAt: "2026-06-21T00:00:00.000Z",
      staleAfter: "2026-06-22T00:00:00.000Z",
      freshness: "fresh",
      relationships: [{ kind: "supports", sourceId: "control_1" }],
    });
    addMemory(memory({
      id: "mem_team_stale",
      orgId,
      title: "Team runbook",
      permissions: ["scope:team", "team:security"],
      updatedAt: "2026-06-20T00:00:00.000Z",
    }));
    saveMemoryMetadata("mem_team_stale", {
      visibility: "team",
      ownerUserId: "stephen",
      teamIds: ["security"],
      validationStatus: "verified",
      sourceUpdatedAt: "2026-06-19T00:00:00.000Z",
      staleAfter: "2026-06-20T00:00:00.000Z",
      freshness: "stale",
      relationships: [],
    });

    const companyOnly = await listBrainMemoryTrail({ orgId, limit: 5 });
    const security = await listBrainMemoryTrail({ orgId, limit: 5, requester: { teamIds: ["security"] } });

    expect(companyOnly).toMatchObject({
      total: 1,
      shown: 1,
      company: 1,
      team: 0,
      relationshipCount: 1,
    });
    expect(security).toMatchObject({
      total: 2,
      shown: 2,
      stale: 1,
      fresh: 1,
      company: 1,
      team: 1,
    });
    expect(security.latest.map((item) => item.title)).toEqual(["Company control", "Team runbook"]);

    deleteMemoryStore({ orgId });
  });
});

function memory(input: {
  id: string;
  orgId: string;
  title: string;
  permissions: string[];
  updatedAt: string;
}): BrainMemory {
  return {
    id: input.id,
    orgId: input.orgId,
    sourceId: input.id.replace("mem_", "source_"),
    sourceType: "manual",
    title: input.title,
    content: `${input.title} content`,
    summary: `${input.title} summary`,
    entities: [],
    embedding: [],
    confidence: 0.9,
    permissions: input.permissions,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    evidence: [{ quote: input.title }],
  };
}
