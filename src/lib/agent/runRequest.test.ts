import { describe, expect, it } from "vitest";
import { validateAgentRunRequest } from "./runRequest";

describe("agent run request validation", () => {
  it("requires a shared secret when configured", () => {
    const result = validateAgentRunRequest({
      body: { targetUrl: "https://example.com" },
      headers: new Headers(),
      defaultOrgId: "demo",
      env: { QUAD_AGENT_RUN_SECRET: "secret" },
    });

    expect(result).toEqual({ ok: false, status: 401, error: "Invalid agent secret." });
  });

  it("fails closed in production when the shared secret is missing", () => {
    const result = validateAgentRunRequest({
      body: { targetUrl: "https://example.com" },
      headers: new Headers(),
      defaultOrgId: "demo",
      env: { NODE_ENV: "production" },
    });

    expect(result).toEqual({ ok: false, status: 500, error: "Agent secret is not configured." });
  });

  it("rejects non-allowlisted orgs", () => {
    const result = validateAgentRunRequest({
      body: { orgId: "evil", targetUrl: "https://example.com" },
      headers: new Headers({ "x-quad-agent-secret": "secret" }),
      defaultOrgId: "demo",
      env: {
        QUAD_AGENT_RUN_SECRET: "secret",
        QUAD_AGENT_ALLOWED_ORGS: "demo",
      },
    });

    expect(result).toEqual({ ok: false, status: 403, error: "orgId is not allowlisted." });
  });

  it("rejects non-allowlisted hosts", () => {
    const result = validateAgentRunRequest({
      body: { targetUrl: "https://evil.example" },
      headers: new Headers({ "x-quad-agent-secret": "secret" }),
      defaultOrgId: "demo",
      env: {
        QUAD_AGENT_RUN_SECRET: "secret",
        QUAD_AGENT_ALLOWED_HOSTS: "example.com",
      },
    });

    expect(result).toEqual({ ok: false, status: 403, error: "targetUrl host is not allowlisted." });
  });

  it("normalizes urls and clamps limits", () => {
    const result = validateAgentRunRequest({
      body: { targetUrl: "https://example.com/security", limit: 100 },
      headers: new Headers({ "x-quad-agent-secret": "secret" }),
      defaultOrgId: "demo",
      env: {
        QUAD_AGENT_RUN_SECRET: "secret",
        QUAD_AGENT_ALLOWED_HOSTS: "example.com",
      },
    });

    expect(result).toEqual({
      ok: true,
      orgId: "demo",
      targetUrl: "https://example.com/security",
      workflow: "enterprise_proof",
      limit: 8,
    });
  });
});
