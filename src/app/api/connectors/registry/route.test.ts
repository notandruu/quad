import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { GET } from "./route";

describe("GET /api/connectors/registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a safe connector registry without secret env values", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", DEMO_ORG_ID);
    vi.stubEnv("BROWSERBASE_API_KEY", "bb_live_secret");
    vi.stubEnv("CMS_API_KEY", "cms_secret");

    const response = await GET(new NextRequest(`http://localhost/api/connectors/registry?orgId=${DEMO_ORG_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      registry: {
        orgId: DEMO_ORG_ID,
        total: expect.any(Number),
        writeCapable: expect.any(Number),
        approvalGated: expect.any(Number),
      },
    });
    expect(body.registry.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityId: "browserbase.write_browser",
          kind: "browser",
          writes: true,
          approvalMode: "human_approval",
        }),
      ])
    );
    expect(JSON.stringify(body)).not.toContain("bb_live_secret");
    expect(JSON.stringify(body)).not.toContain("cms_secret");
  });
});
