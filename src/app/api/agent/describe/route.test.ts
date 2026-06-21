import { afterEach, describe, expect, it, vi } from "vitest";
import { expectPublicPayloadHasNoSecrets } from "@/lib/security/publicPayload";
import { GET } from "./route";

describe("GET /api/agent/describe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a public agent card without leaking configured secret values", async () => {
    const env = secretEnv();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "quad.enterprise-trust-agent",
      trust: {
        security: {
          exposesSecrets: false,
        },
      },
    });
    expectPublicPayloadHasNoSecrets(body, env);
  });
});

function secretEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_APP_URL: "https://app.quad.example",
    ANTHROPIC_API_KEY: "sk-ant-agent-describe-secret-1234567890",
    OPENAI_API_KEY: "sk-proj-agent-describe-secret-1234567890",
    QUAD_API_SECRET: "quad-agent-describe-secret-1234567890",
    QUAD_SERVICE_TOKENS: JSON.stringify([
      {
        token: "service-token-agent-describe-secret-1234567890",
        orgs: ["org_agent"],
        scopes: ["agent:run"],
      },
    ]),
    SUPABASE_SERVICE_KEY: "supabase-agent-describe-secret-1234567890",
    BROWSERBASE_API_KEY: "bb_live_agent_describe_secret_1234567890",
    DEEPGRAM_API_KEY: "deepgram-agent-describe-secret-1234567890",
    SENTRY_DSN: "https://public:agent-describe-secret@sentry.example/1",
  };
}
