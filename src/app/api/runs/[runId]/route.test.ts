import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkflowRun } from "@/lib/runs";
import { GET } from "./route";

describe("GET /api/runs/[runId]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns run detail for a token scoped to the run org", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "run-reader-token",
        orgs: ["org_run_route"],
        scopes: ["jobs:read"],
      },
    ]));
    const run = createWorkflowRun({
      id: "run_route_visible",
      orgId: "org_run_route",
      workflowKind: "website_audit",
      title: "Visible run",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });

    const response = await GET(authRequest("run-reader-token"), { params: { runId: run.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.detail.run).toMatchObject({
      id: run.id,
      orgId: "org_run_route",
    });
  });

  it("does not reveal run existence to a token scoped to another org", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "wrong-org-token",
        orgs: ["org_wrong_route"],
        scopes: ["jobs:read"],
      },
    ]));
    const run = createWorkflowRun({
      id: "run_route_hidden",
      orgId: "org_hidden_route",
      workflowKind: "website_audit",
      title: "Hidden run",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });

    const response = await GET(authRequest("wrong-org-token"), { params: { runId: run.id } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      ok: false,
      code: "run_not_found",
    });
  });
});

function authRequest(token: string): NextRequest {
  return new NextRequest("http://localhost/api/runs/test", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}
