import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectPublicPayloadHasNoSecrets } from "@/lib/security/publicPayload";
import { GET } from "./route";

describe("GET /api/security/packet", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns registry boundary policy without leaking configured secret values", async () => {
    const env = secretEnv();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const response = await GET(new NextRequest("http://localhost/api/security/packet?orgId=org_secure", {
      headers: {
        authorization: `Bearer ${env.QUAD_API_SECRET}`,
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.packet.registryBoundary.anchoringPolicy).toMatchObject({
      v1: "local_receipts_only",
      blockchain: "optional_future",
      privateDataNeverAnchored: expect.arrayContaining([
        "raw context",
        "credentials",
        "customer documents",
      ]),
    });
    expectPublicPayloadHasNoSecrets(body, env);
  });
});

function secretEnv(): Record<string, string> {
  return {
    QUAD_API_SECRET: "quad-security-packet-secret-1234567890",
    QUAD_ALLOWED_ORGS: "org_secure",
    ANTHROPIC_API_KEY: "sk-ant-security-packet-secret-1234567890",
    OPENAI_API_KEY: "sk-proj-security-packet-secret-1234567890",
    DATABASE_URL: "postgresql://user:security-packet-secret@db.example/postgres",
    SUPABASE_SERVICE_KEY: "supabase-security-packet-secret-1234567890",
    QUAD_REDIS_REST_TOKEN: "redis-security-packet-secret-1234567890",
    BROWSERBASE_API_KEY: "bb_live_security_packet_secret_1234567890",
    DEEPGRAM_API_KEY: "deepgram-security-packet-secret-1234567890",
    SENTRY_DSN: "https://public:security-packet-secret@sentry.example/1",
  };
}
