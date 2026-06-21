import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkflowRun, listRunSnapshots } from "@/lib/runs";
import { POST } from "./route";

describe("POST /api/security/retention/sweep", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dry-runs expired run cleanup without deleting data", async () => {
    vi.stubEnv("QUAD_API_SECRET", "admin-secret");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_RETENTION_DAYS", "7");
    const orgId = "org_retention_route_dry";
    createWorkflowRun({
      id: "run_retention_route_old",
      orgId,
      workflowKind: "website_audit",
      title: "Old retention route run",
      createdBy: "dashboard",
      now: "2026-06-01T00:00:00.000Z",
    });

    const response = await POST(jsonRequest({
      orgId,
      mode: "dry_run",
      limit: 5,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sweep).toMatchObject({
      mode: "dry_run",
      retentionDays: 7,
      executed: false,
      candidates: [
        {
          runId: "run_retention_route_old",
        },
      ],
    });
    expect(await listRunSnapshots({ orgId })).toHaveLength(1);
  });

  it("rejects execution without sweep confirmation", async () => {
    vi.stubEnv("QUAD_API_SECRET", "admin-secret");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_RETENTION_DAYS", "7");

    const response = await POST(jsonRequest({
      orgId: "org_retention_route_confirm",
      mode: "execute",
      confirmation: "retention:wrong",
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "confirmation_required",
    });
  });
});

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/security/retention/sweep", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer admin-secret",
    },
    body: JSON.stringify(body),
  });
}
