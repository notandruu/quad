import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addArtifact, addTask, createWorkflowRun } from "@/lib/runs";
import { GET } from "./route";

describe("GET /api/runs/[runId]/events", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a cursorable hosted task stream for an authorized org token", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "event-reader-token",
        orgs: ["org_event_route"],
        scopes: ["jobs:read"],
      },
    ]));
    const run = createWorkflowRun({
      id: "run_events_visible",
      orgId: "org_event_route",
      workflowKind: "website_audit",
      title: "Visible event run",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });
    addTask({
      runId: run.id,
      title: "Collect proof",
      status: "running",
      owner: "quad",
      detail: "Collecting browser evidence.",
      now: "2026-06-21T00:00:01.000Z",
    });
    addArtifact({
      runId: run.id,
      kind: "receipt",
      title: "Private receipt",
      data: {
        privateEvidence: "customer-private-proof",
        publicSummary: "safe",
      },
      now: "2026-06-21T00:00:02.000Z",
    });

    const response = await GET(authRequest("event-reader-token", "after=1&limit=2"), {
      params: { runId: run.id },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stream.run).toMatchObject({
      id: run.id,
      orgId: "org_event_route",
    });
    expect(body.stream.events).toHaveLength(2);
    expect(body.stream.events[0]).toMatchObject({
      sequence: 2,
      kind: "task.running",
    });
    expect(body.stream.cursor).toMatchObject({
      afterSequence: 1,
      latestSequence: 3,
      nextAfterSequence: null,
      limit: 2,
    });
    expect(JSON.stringify(body)).not.toContain("customer-private-proof");
  });

  it("does not reveal event streams across org scopes", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "wrong-event-reader-token",
        orgs: ["org_wrong_events"],
        scopes: ["jobs:read"],
      },
    ]));
    const run = createWorkflowRun({
      id: "run_events_hidden",
      orgId: "org_hidden_events",
      workflowKind: "website_audit",
      title: "Hidden event run",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });

    const response = await GET(authRequest("wrong-event-reader-token"), { params: { runId: run.id } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      ok: false,
      code: "run_not_found",
    });
  });
});

function authRequest(token: string, search = ""): NextRequest {
  const suffix = search ? `?${search}` : "";
  return new NextRequest(`http://localhost/api/runs/test/events${suffix}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}
