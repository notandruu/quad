import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { POST } from "./route";

describe("POST /api/core/run", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs chat through the shared core route", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("KALI_CHAT_MODEL", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const response = await POST(jsonRequest({
      command: "chat",
      orgId: DEMO_ORG_ID,
      runId: "run_core_route_chat",
      text: "hello quad",
      surface: "chat",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      command: "chat",
      runId: "run_core_route_chat",
      intent: "general_chat",
      quadChain: {
        accepted: true,
      },
    });
  });

  it("queues audit work through the shared core route", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const response = await POST(jsonRequest({
      command: "queue_audit",
      orgId: DEMO_ORG_ID,
      runId: "run_core_route_queue",
      targetUrl: "https://example.com",
      surface: "dashboard",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      command: "queue_audit",
      runId: "run_core_route_queue",
      job: {
        type: "audit",
        status: "queued",
      },
    });
  });

  it("rejects malformed payloads", async () => {
    const response = await POST(jsonRequest({
      command: "queue_audit",
      targetUrl: "not a url",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid core run request.",
    });
  });
});

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/core/run", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}
