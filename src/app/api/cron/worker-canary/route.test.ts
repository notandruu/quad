import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("GET /api/cron/worker-canary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs a scheduled worker canary in demo fallback when no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_WORKER_SECRET", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      scheduled: true,
      authMode: "demo_fallback",
      skipped: expect.any(Boolean),
    });
  });

  it("requires Vercel cron authorization when CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "cron_test_secret");

    const rejected = await GET(request());
    const accepted = await GET(request({ authorization: "Bearer cron_test_secret" }));

    expect(rejected.status).toBe(401);
    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      code: "invalid_cron_secret",
    });
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({
      ok: true,
      scheduled: true,
      authMode: "cron_secret",
    });
  });
});

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/worker-canary?minIntervalSeconds=1", {
    method: "GET",
    headers,
  });
}
