import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/agent/run", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("queues external agent work through quad core", async () => {
    vi.stubEnv("QUAD_AGENT_RUN_SECRET", "agent-secret");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const response = await POST(jsonRequest({
      orgId: "org_agent_route",
      targetUrl: "https://example.com",
      workflow: "enterprise_proof",
      limit: 3,
    }, "agent-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      agent: "quad",
      workflow: "enterprise_proof",
      mode: "memory",
      job: {
        type: "agent_run",
        status: "queued",
      },
      summary: {
        status: "queued",
        title: "Enterprise proof run",
      },
      runtime: {
        surface: "fetch_agent",
      },
      quadChain: [
        {
          type: "agent_handoff",
          accepted: true,
        },
      ],
    });
    expect(body.runtime.selectedTools).toContain("fetch.agent_bridge");
  });

  it("still rejects invalid external agent secrets", async () => {
    vi.stubEnv("QUAD_AGENT_RUN_SECRET", "agent-secret");

    const response = await POST(jsonRequest({
      targetUrl: "https://example.com",
    }, "wrong"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid agent secret." });
  });
});

function jsonRequest(body: unknown, secret: string): NextRequest {
  return new NextRequest("http://localhost/api/agent/run", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-quad-agent-secret": secret,
    },
  });
}
