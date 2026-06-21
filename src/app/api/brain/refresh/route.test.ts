import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { getRunSnapshot } from "@/lib/runs";
import { findMemoryBySourceId } from "@/lib/brain/retrieve";
import { addMemory, deleteMemoryStore } from "@/lib/brain/store";
import { saveMemoryMetadata } from "@/lib/brain/metadata";
import type { BrainMemory } from "@/lib/types";
import { POST } from "./route";

vi.mock("@/lib/brain/db", () => ({
  getClient: vi.fn(() => null),
  ensureSchema: vi.fn(async () => undefined),
}));

describe("POST /api/brain/refresh", () => {
  it("creates an approval-backed refresh proposal without directly writing memory", async () => {
    const orgId = "org_brightpath";
    const sourceId = "route_refresh_source";
    deleteMemoryStore({ orgId, sourceId });
    addMemory(memory({
      id: "route_refresh_memory",
      orgId,
      sourceId,
      title: "Buyer proof notes",
      updatedAt: "2026-06-01T00:00:00.000Z",
    }));
    saveMemoryMetadata("route_refresh_memory", {
      visibility: "company",
      ownerUserId: null,
      teamIds: [],
      validationStatus: "approved",
      sourceUpdatedAt: "2026-06-01T00:00:00.000Z",
      staleAfter: "2026-06-10T00:00:00.000Z",
      freshness: "stale",
      relationships: [],
    });

    const response = await POST(jsonRequest({
      memoryId: "route_refresh_memory",
      sourceId,
      nextStaleAfter: "2026-07-21T00:00:00.000Z",
    }));
    const body = await response.json();
    const snapshot = getRunSnapshot(body.runId);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      mode: "proposal",
      refresh: {
        originalMemoryId: "route_refresh_memory",
        originalSourceId: sourceId,
        nextStaleAfter: "2026-07-21T00:00:00.000Z",
      },
      packet: {
        type: "approval",
        accepted: true,
      },
      task: {
        status: "needs_approval",
      },
    });
    expect(snapshot?.run.workflowKind).toBe("memory_write");
    expect(snapshot?.approvals).toHaveLength(1);
    expect(await findMemoryBySourceId(orgId, body.refresh.refreshSourceId)).toBeNull();

    deleteMemoryStore({ orgId, sourceId });
  });

  it("requires a memory id or source id", async () => {
    const response = await POST(jsonRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: "memoryId or sourceId required",
    });
  });
});

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/brain/refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function memory(input: {
  id: string;
  orgId: string;
  sourceId: string;
  title: string;
  updatedAt: string;
}): BrainMemory {
  return {
    id: input.id,
    orgId: input.orgId,
    sourceId: input.sourceId,
    sourceType: "manual",
    title: input.title,
    content: `${input.title} stale content`,
    summary: `${input.title} stale summary`,
    entities: [],
    embedding: [],
    confidence: 0.8,
    permissions: ["scope:company"],
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    evidence: [{ quote: `${input.title} stale content` }],
  };
}
