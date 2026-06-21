import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTERPRISE_PROOF_ORG_ID } from "@/data/demo/enterprise-proof";
import { deleteMemoryStore } from "@/lib/brain/store";
import { getRunSnapshot } from "@/lib/runs";
import { POST } from "./route";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("POST /api/enterprise-proof", () => {
  beforeEach(() => {
    clearHostedEnv();
    deleteMemoryStore({ orgId: ENTERPRISE_PROOF_ORG_ID });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps demo fallback working for the enterprise proof org", async () => {
    const runId = `route_ep_demo_${crypto.randomUUID()}`;
    const response = await POST(jsonRequest({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      runId,
      question: "Zyzzplork quantum banana control?",
    }));
    const body = await response.json();
    const snapshot = getRunSnapshot(runId);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      result: {
        status: "needs_human",
      },
      brainGrowth: {
        status: "needs_human",
        memoryId: null,
        visibility: "company",
        approvalRequired: false,
      },
      run: {
        runId,
        status: "failed",
      },
    });
    expect(snapshot?.run.workflowKind).toBe("enterprise_proof");
    expect(snapshot?.tasks.some((task) => task.status === "blocked")).toBe(true);
  });

  it("requires hosted auth when an api secret is configured", async () => {
    vi.stubEnv("QUAD_API_SECRET", "secret_test");

    const response = await POST(jsonRequest({
      orgId: "org_locked_enterprise",
      question: "Do you have MFA?",
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      code: "missing_secret",
    });
  });

  it("replays idempotent requests before checking run id conflicts", async () => {
    const runId = `route_ep_idem_${crypto.randomUUID()}`;
    const body = {
      orgId: ENTERPRISE_PROOF_ORG_ID,
      runId,
      question: "Zyzzplork quantum banana control?",
    };

    const first = await POST(jsonRequest(body, { "idempotency-key": "same-answer" }));
    const replay = await POST(jsonRequest(body, { "idempotency-key": "same-answer" }));
    const firstBody = await first.json();
    const replayBody = await replay.json();

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replayBody).toMatchObject({
      run: {
        runId: firstBody.run.runId,
      },
      idempotency: {
        replayed: true,
        key: "same-answer",
      },
    });
  });

  it("rejects a caller-supplied run id that already exists without an idempotency replay", async () => {
    const runId = `route_ep_conflict_${crypto.randomUUID()}`;
    const body = {
      orgId: ENTERPRISE_PROOF_ORG_ID,
      runId,
      question: "Zyzzplork quantum banana control?",
    };

    const first = await POST(jsonRequest(body));
    const second = await POST(jsonRequest(body));
    const conflict = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(conflict).toMatchObject({
      ok: false,
      code: "run_conflict",
    });
  });

  it("returns a brain-growth summary for enterprise proof attempts", async () => {
    const runId = `route_ep_growth_${crypto.randomUUID()}`;
    const response = await POST(jsonRequest({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      runId,
      question: "Do you have a documented incident response plan?",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      result: {
        status: "needs_human",
      },
      brainGrowth: {
        status: "needs_human",
        sourceId: expect.stringMatching(/^ep:org_acme:/),
      },
    });
  });
});

function clearHostedEnv() {
  vi.stubEnv("QUAD_API_SECRET", "");
  vi.stubEnv("QUAD_SERVICE_TOKENS", "");
  vi.stubEnv("QUAD_ALLOWED_ORGS", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("QUAD_REDIS_REST_URL", "");
  vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

function jsonRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/enterprise-proof", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
