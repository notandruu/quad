import { describe, expect, it } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { authorizeRequest } from "./request";

function headers(input: Record<string, string> = {}) {
  return new Headers(input);
}

describe("request auth", () => {
  it("allows the demo org without secrets for zero-key mode", () => {
    const result = authorizeRequest({
      headers: headers(),
      requestedOrgId: DEMO_ORG_ID,
      env: {},
    });

    expect(result).toMatchObject({
      ok: true,
      orgId: DEMO_ORG_ID,
      mode: "demo_fallback",
    });
  });

  it("rejects non-demo orgs in zero-key fallback mode", () => {
    const result = authorizeRequest({
      headers: headers(),
      requestedOrgId: "org_customer",
      env: {},
    });

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "org_not_allowed",
    });
  });

  it("accepts a global bearer secret for hosted access", () => {
    const result = authorizeRequest({
      headers: headers({ authorization: "Bearer secret_123" }),
      requestedOrgId: "org_customer",
      env: { QUAD_API_SECRET: "secret_123", QUAD_ALLOWED_ORGS: "" },
    });

    expect(result).toMatchObject({
      ok: true,
      orgId: "org_customer",
      mode: "secret",
    });
  });

  it("accepts x-quad-api-key as the same api secret", () => {
    const result = authorizeRequest({
      headers: headers({ "x-quad-api-key": "secret_123" }),
      requestedOrgId: "org_customer",
      env: { QUAD_API_SECRET: "secret_123", QUAD_ALLOWED_ORGS: "" },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects missing or wrong secrets when hosted auth is configured", () => {
    const missing = authorizeRequest({
      headers: headers(),
      requestedOrgId: "org_customer",
      env: { QUAD_API_SECRET: "secret_123", QUAD_ALLOWED_ORGS: "" },
    });
    const wrong = authorizeRequest({
      headers: headers({ authorization: "Bearer nope" }),
      requestedOrgId: "org_customer",
      env: { QUAD_API_SECRET: "secret_123", QUAD_ALLOWED_ORGS: "" },
    });

    expect(missing).toMatchObject({ ok: false, status: 401, code: "missing_secret" });
    expect(wrong).toMatchObject({ ok: false, status: 401, code: "invalid_secret" });
  });

  it("enforces the org allowlist after secret auth", () => {
    const allowed = authorizeRequest({
      headers: headers({ authorization: "Bearer secret_123" }),
      requestedOrgId: "org_a",
      env: {
        QUAD_API_SECRET: "secret_123",
        QUAD_ALLOWED_ORGS: "org_a,org_b",
      },
    });
    const blocked = authorizeRequest({
      headers: headers({ authorization: "Bearer secret_123" }),
      requestedOrgId: "org_c",
      env: {
        QUAD_API_SECRET: "secret_123",
        QUAD_ALLOWED_ORGS: "org_a,org_b",
      },
    });

    expect(allowed.ok).toBe(true);
    expect(blocked).toMatchObject({ ok: false, status: 403, code: "org_not_allowed" });
  });

  it("supports route-specific worker secrets", () => {
    const result = authorizeRequest({
      headers: headers({ authorization: "Bearer worker_secret" }),
      requiredSecretEnv: "QUAD_WORKER_SECRET",
      env: { QUAD_WORKER_SECRET: "worker_secret" },
    });

    expect(result).toMatchObject({ ok: true, mode: "secret" });
  });
});
