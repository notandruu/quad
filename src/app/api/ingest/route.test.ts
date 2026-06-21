import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRunSnapshot } from "@/lib/runs";
import { findMemoryBySourceId } from "@/lib/brain/retrieve";
import { POST } from "./route";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("POST /api/ingest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to an approval-backed memory proposal", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");

    const response = await POST(jsonRequest({
      title: "Approved memory only",
      content: "The shared brain should not learn this before approval.",
      sourceId: "route_memory_proposal_1",
      sourceType: "manual",
      evidence: [{ quote: "not learn this before approval" }],
    }));
    const body = await response.json();
    const snapshot = getRunSnapshot(body.runId);
    const memory = await findMemoryBySourceId("org_brightpath", "route_memory_proposal_1");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      mode: "proposal",
      approvalId: expect.stringMatching(/^approval_/),
      task: {
        status: "needs_approval",
      },
      packet: {
        type: "approval",
        accepted: true,
      },
    });
    expect(snapshot?.run.workflowKind).toBe("memory_write");
    expect(snapshot?.approvals).toHaveLength(1);
    expect(memory).toBeNull();
  });

  it("records scoped memory permissions in the proposal preview", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");

    const response = await POST(jsonRequest({
      title: "Private operator preference",
      content: "Stephen wants deploy notes grouped by sponsor track.",
      sourceId: "route_memory_personal_1",
      sourceType: "manual",
      visibility: "personal",
      userId: "stephen",
    }));
    const body = await response.json();
    const snapshot = getRunSnapshot(body.runId);
    const data = snapshot?.artifacts[0]?.data as { preview?: { permissions?: string[] } } | undefined;

    expect(response.status).toBe(200);
    expect(data?.preview?.permissions).toEqual(expect.arrayContaining([
      "scope:personal",
      "user:stephen",
    ]));
  });
});

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
