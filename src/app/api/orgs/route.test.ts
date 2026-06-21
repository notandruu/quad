import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { GET } from "./route";

vi.mock("@/lib/brain/db", () => ({
  getClient: vi.fn(() => null),
}));

describe("GET /api/orgs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the demo org workspace context in zero-key mode", async () => {
    clearHostedEnv();

    const response = await GET(request(`/api/orgs?orgId=${DEMO_ORG_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId: DEMO_ORG_ID,
      current: {
        org: {
          id: DEMO_ORG_ID,
          status: "active",
        },
        workspace: {
          orgId: DEMO_ORG_ID,
          defaultVisibility: "company",
        },
        requester: {
          role: "service",
          canApprove: true,
        },
        boundary: {
          tenantKeyPrefix: `org:${DEMO_ORG_ID}`,
        },
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/sk-ant-|sk-proj-|service_role|bb_live_|gQAAAA/);
  });

  it("requires a scoped service token when hosted secrets are configured", async () => {
    vi.stubEnv("QUAD_API_SECRET", "admin_secret");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "viewer_secret",
        orgs: ["org_alpha"],
        scopes: ["orgs:read"],
        label: "viewer",
      },
    ]));
    vi.stubEnv("QUAD_ALLOWED_ORGS", "org_alpha");

    const missing = await GET(request("/api/orgs?orgId=org_alpha"));
    expect(missing.status).toBe(401);

    const scoped = await GET(request("/api/orgs?orgId=org_alpha", {
      authorization: "Bearer viewer_secret",
    }));
    const body = await scoped.json();

    expect(scoped.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      mode: "service_token",
      current: {
        org: {
          id: "org_alpha",
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("viewer_secret");
    expect(JSON.stringify(body)).not.toContain("admin_secret");
  });

  it("rejects tokens without org read scope", async () => {
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "worker_secret",
        orgs: ["org_alpha"],
        scopes: ["jobs:write"],
      },
    ]));
    vi.stubEnv("QUAD_ALLOWED_ORGS", "org_alpha");

    const response = await GET(request("/api/orgs?orgId=org_alpha", {
      authorization: "Bearer worker_secret",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      code: "scope_not_allowed",
    });
  });
});

function clearHostedEnv() {
  vi.stubEnv("QUAD_API_SECRET", "");
  vi.stubEnv("QUAD_SERVICE_TOKENS", "");
  vi.stubEnv("QUAD_ALLOWED_ORGS", "");
}

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers,
  });
}
