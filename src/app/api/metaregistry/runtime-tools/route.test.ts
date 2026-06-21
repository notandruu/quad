import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/metaregistry/runtime-tools", () => {
  it("returns a runtime routing plan without exposing secret values", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/metaregistry/runtime-tools?orgId=org_redcross&intent=website_audit&surface=fetch_agent"
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId: "org_redcross",
      plan: {
        intent: "website_audit",
        surface: "fetch_agent",
        requiredCapabilityIds: expect.arrayContaining(["browserbase.read_browser", "fetch.agent_bridge"]),
        eagerTools: expect.any(Array),
        deferredTools: expect.any(Array),
        blockedCapabilities: expect.any(Array),
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
    expect(JSON.stringify(body)).not.toMatch(/sk-ant-|sk-proj-|postgres:\/\/|service_role|bb_live_|gQAAAA/);
  });
});
