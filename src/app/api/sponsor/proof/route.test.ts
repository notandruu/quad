import { afterEach, describe, expect, it, vi } from "vitest";
import { expectPublicPayloadHasNoSecrets } from "@/lib/security/publicPayload";
import { GET } from "./route";

describe("GET /api/sponsor/proof", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps booth-safe sponsor summaries free of configured secret values", async () => {
    const env = secretEnv();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.demoRunbook.boothChecklist).toEqual(expect.arrayContaining([
      expect.stringContaining("Never show env values"),
    ]));
    expectPublicPayloadHasNoSecrets(body, env);
  });
});

function secretEnv(): Record<string, string> {
  return {
    ANTHROPIC_API_KEY: "sk-ant-sponsor-proof-secret-1234567890",
    OPENAI_API_KEY: "sk-proj-sponsor-proof-secret-1234567890",
    QUAD_API_SECRET: "quad-sponsor-proof-secret-1234567890",
    QUAD_REDIS_REST_TOKEN: "redis-sponsor-proof-secret-1234567890",
    SUPABASE_SERVICE_KEY: "supabase-sponsor-proof-secret-1234567890",
    BROWSERBASE_API_KEY: "bb_live_sponsor_proof_secret_1234567890",
    DEEPGRAM_API_KEY: "deepgram-sponsor-proof-secret-1234567890",
    SENTRY_DSN: "https://public:sponsor-proof-secret@sentry.example/1",
  };
}
