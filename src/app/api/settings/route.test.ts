import { afterEach, describe, expect, it, vi } from "vitest";
import { expectPublicPayloadHasNoSecrets } from "@/lib/security/publicPayload";
import { GET } from "./route";

vi.mock("@/lib/brain", () => ({
  isBrainConfigured: vi.fn(() => false),
  pingBrain: vi.fn(async () => ({ ok: false })),
}));

describe("GET /api/settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns backend readiness booleans without leaking configured secret values", async () => {
    const env = secretEnv();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      browserbase: true,
      deepgram: true,
      sentry: true,
    });
    expectPublicPayloadHasNoSecrets(body, env);
  });
});

function secretEnv(): Record<string, string> {
  return {
    ANTHROPIC_API_KEY: "sk-ant-settings-route-secret-1234567890",
    OPENAI_API_KEY: "sk-proj-settings-route-secret-1234567890",
    QUAD_API_SECRET: "quad-settings-route-secret-1234567890",
    QUAD_REDIS_REST_TOKEN: "redis-settings-route-secret-1234567890",
    SUPABASE_SERVICE_KEY: "supabase-settings-route-secret-1234567890",
    BROWSERBASE_API_KEY: "bb_live_settings_route_secret_1234567890",
    BROWSERBASE_PROJECT_ID: "project-settings-route-secret",
    DEEPGRAM_API_KEY: "deepgram-settings-route-secret-1234567890",
    SENTRY_DSN: "https://public:settings-route-secret@sentry.example/1",
    PHOENIX_COLLECTOR_ENDPOINT: "https://phoenix.example/v1/traces",
  };
}
