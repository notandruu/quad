import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/metaregistry/install-plan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a safe starter bundle install plan without exposing secret values", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "org_redcross");
    vi.stubEnv("BROWSERBASE_API_KEY", "bb_secret");
    vi.stubEnv("BROWSERBASE_PROJECT_ID", "project_secret");
    vi.stubEnv("QUAD_CAPABILITY_DISABLED", "sentry.reliability");

    const response = await GET(new NextRequest("http://localhost/api/metaregistry/install-plan?orgId=org_redcross"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId: "org_redcross",
      plan: {
        bundleId: "enterprise_proof_starter",
        unknownIds: [],
      },
    });
    expect(body.plan.newlyAllowlisted).toContain("browserbase.read_browser");
    expect(body.plan.blockedAfterInstall).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sentry.reliability",
          reason: "Capability is disabled by org policy.",
        }),
      ])
    );
    expect(JSON.stringify(body)).not.toContain("bb_secret");
    expect(JSON.stringify(body)).not.toContain("project_secret");
  });

  it("plans write tool enablement as force-install plus allowlist", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");

    const response = await GET(
      new NextRequest("http://localhost/api/metaregistry/install-plan?orgId=org_redcross&includeWriteTools=1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.plan.newlyAllowlisted).toEqual(expect.arrayContaining(["cms.publisher", "task.publisher"]));
    expect(body.plan.newlyForceInstalled).toEqual(expect.arrayContaining(["cms.publisher", "task.publisher"]));
    expect(body.plan.envRequired).toEqual(
      expect.arrayContaining([
        { id: "cms.publisher", missingEnv: ["CMS_API_KEY"] },
        { id: "task.publisher", missingEnv: ["LINEAR_API_KEY"] },
      ])
    );
  });
});
