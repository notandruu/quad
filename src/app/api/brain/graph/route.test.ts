import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { BrainMemory } from "@/lib/types";
import { addMemory, deleteMemoryStore } from "@/lib/brain/store";
import { saveMemoryMetadata } from "@/lib/brain/metadata";
import { GET } from "./route";

vi.mock("@/lib/brain/db", () => ({
  getClient: vi.fn(() => null),
}));

describe("GET /api/brain/graph", () => {
  it("returns a scoped graph summary without raw private memory text", async () => {
    const orgId = "org_redcross";
    const sourceId = "route_graph_source";
    deleteMemoryStore({ orgId, sourceId });
    addMemory({
      id: "route_graph_memory",
      orgId,
      sourceId,
      sourceType: "manual",
      title: "Route graph memory",
      content: "raw private route graph content",
      summary: "Route graph summary",
      entities: ["route-graph"],
      embedding: [],
      confidence: 0.88,
      permissions: ["scope:company"],
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z",
      evidence: [{ quote: "raw private route graph content" }],
    } satisfies BrainMemory);
    saveMemoryMetadata("route_graph_memory", {
      visibility: "company",
      ownerUserId: null,
      teamIds: [],
      validationStatus: "approved",
      sourceUpdatedAt: "2026-06-21T00:00:00.000Z",
      staleAfter: "2026-07-21T00:00:00.000Z",
      freshness: "fresh",
      relationships: [],
    });

    const response = await GET(new NextRequest("http://localhost/api/brain/graph?orgId=org_redcross&limit=100"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId,
      summary: {
        total: expect.any(Number),
        byVisibility: {
          company: expect.any(Number),
        },
      },
      graph: {
        orgId,
      },
    });
    expect(body.graph.nodes.some((node: { id: string }) => node.id === "memory:route_graph_memory")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("raw private route graph content");

    deleteMemoryStore({ orgId, sourceId });
  });
});
