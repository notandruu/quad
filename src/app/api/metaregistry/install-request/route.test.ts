import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRunSnapshot } from "@/lib/runs";
import { POST } from "./route";

describe("POST /api/metaregistry/install-request", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a safe install request run without exposing env values", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "org_redcross");
    vi.stubEnv("CMS_API_KEY", "cms_secret");

    const response = await POST(jsonRequest({
      orgId: "org_redcross",
      actor: "route.test",
      includeWriteTools: true,
    }));
    const body = await response.json();
    const snapshot = getRunSnapshot(body.runId);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      approvalId: expect.stringMatching(/^approval_/),
      task: {
        status: "needs_approval",
      },
      packet: {
        type: "connector_action",
        accepted: true,
      },
    });
    expect(snapshot?.run.workflowKind).toBe("capability_install");
    expect(snapshot?.approvals).toHaveLength(1);
    expect(snapshot?.artifacts[0].kind).toBe("approval_request");
    expect(JSON.stringify(body)).not.toContain("cms_secret");
  });

  it("rejects empty custom install requests", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");

    const response = await POST(jsonRequest({
      orgId: "org_redcross",
      capabilityIds: ["missing.capability"],
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      code: "empty_plan",
    });
  });
});

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/metaregistry/install-request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
