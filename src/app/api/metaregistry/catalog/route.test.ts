import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { GET } from "./route";

describe("GET /api/metaregistry/catalog", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a safe capability catalog without exposing secret env values", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", DEMO_ORG_ID);
    vi.stubEnv("BROWSERBASE_API_KEY", "bb_secret_value");
    vi.stubEnv("BROWSERBASE_PROJECT_ID", "browserbase_project_secret");
    vi.stubEnv("QUAD_CAPABILITY_ALLOWLIST", "browserbase.write_browser");
    vi.stubEnv("QUAD_CAPABILITY_FORCE_INSTALLED", "browserbase.write_browser");

    const response = await GET(new NextRequest(`http://localhost/api/metaregistry/catalog?orgId=${DEMO_ORG_ID}&limit=20`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId: DEMO_ORG_ID,
      catalog: {
        total: expect.any(Number),
        active: expect.any(Number),
        writeCapable: expect.any(Number),
        approvalGated: expect.any(Number),
      },
    });
    expect(body.catalog.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "browserbase.write_browser",
          stateLabel: "active",
          nextAction: "ready for routing.",
        }),
      ])
    );
    expect(JSON.stringify(body)).not.toContain("bb_secret_value");
    expect(JSON.stringify(body)).not.toContain("browserbase_project_secret");
  });

  it("can return summary-only mode for compact surfaces", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");

    const response = await GET(new NextRequest("http://localhost/api/metaregistry/catalog?entries=0"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.catalog.entries).toEqual([]);
    expect(body.catalog.kinds.length).toBeGreaterThan(0);
    expect(body.catalog.sponsors.length).toBeGreaterThan(0);
  });
});
