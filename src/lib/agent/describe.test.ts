import { describe, expect, it } from "vitest";
import { buildQuadAgentDescription } from "./describe";

describe("quad agent description", () => {
  it("builds a public fetch-ready agent card", () => {
    const card = buildQuadAgentDescription({
      baseUrl: "https://app.quad.stephenhung.me/",
      version: "9.9.9",
      env: {
        BROWSERBASE_API_KEY: "bb_secret",
        BROWSERBASE_PROJECT_ID: "project",
        QUAD_REDIS_REST_URL: "https://redis.example",
        QUAD_REDIS_REST_TOKEN: "redis_secret",
      },
    });

    expect(card.id).toBe("quad.enterprise-trust-agent");
    expect(card.version).toBe("9.9.9");
    expect(card.endpoints.run).toBe("https://app.quad.stephenhung.me/api/agent/run");
    expect(card.protocols).toContain("agent_chat_protocol_ready");
    expect(card.workflows.map((workflow) => workflow.id)).toEqual(["enterprise_proof", "website_audit"]);
    expect(card.capabilities.find((capability) => capability.id === "fetch.agent_bridge")?.status).toBe("active");
    expect(card.sponsorAlignment.map((item) => item.sponsor)).toContain("Fetch.ai");
  });

  it("never advertises the landing host as the app api surface", () => {
    const card = buildQuadAgentDescription({
      baseUrl: "https://quad.stephenhung.me/",
      env: {},
    });

    expect(card.provider.url).toBe("https://app.quad.stephenhung.me");
    expect(card.endpoints.describe).toBe("https://app.quad.stephenhung.me/api/agent/describe");
    expect(card.endpoints.run).toBe("https://app.quad.stephenhung.me/api/agent/run");
  });

  it("does not expose secret values or env key names", () => {
    const card = buildQuadAgentDescription({
      baseUrl: "https://quad.test",
      env: {
        OPENAI_API_KEY: "sk-secret-value",
        QUAD_API_SECRET: "quad-secret",
        DEEPGRAM_API_KEY: "deepgram-secret",
      },
    });

    const serialized = JSON.stringify(card);

    expect(serialized).not.toContain("sk-secret-value");
    expect(serialized).not.toContain("quad-secret");
    expect(serialized).not.toContain("deepgram-secret");
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).not.toContain("QUAD_API_SECRET");
    expect(serialized).not.toContain("DEEPGRAM_API_KEY");
    expect(card.trust.security.exposesSecrets).toBe(false);
  });
});
