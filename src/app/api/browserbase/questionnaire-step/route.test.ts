import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENTERPRISE_PROOF_ORG_ID } from "@/data/demo/enterprise-proof";
import { createWorkflowRun, loadRunSnapshot } from "@/lib/runs";
import { POST } from "./route";

const page = {
  goto: vi.fn(async () => undefined),
  locator: vi.fn(() => ({
    focus: vi.fn(async () => undefined),
    fill: vi.fn(async () => undefined),
    evaluate: vi.fn(async (fn: (el: { textContent: string }) => void) => fn({ textContent: "" })),
  })),
  screenshot: vi.fn(async () => Buffer.from("fake png")),
  waitForTimeout: vi.fn(async () => undefined),
};

const browser = {
  contexts: vi.fn(() => [
    {
      pages: vi.fn(() => [page]),
      newPage: vi.fn(async () => page),
    },
  ]),
  newContext: vi.fn(async () => ({
    pages: vi.fn(() => [page]),
    newPage: vi.fn(async () => page),
  })),
  close: vi.fn(async () => undefined),
};

vi.mock("@browserbasehq/sdk", () => ({
  Browserbase: class {
    sessions = {
      create: vi.fn(async () => ({
        id: "bb_test_session",
        connectUrl: "wss://browserbase.test/session",
      })),
    };
  },
}));

vi.mock("playwright-core", () => ({
  chromium: {
    connectOverCDP: vi.fn(async () => browser),
  },
}));

vi.mock("@/lib/storage/screenshots", () => ({
  uploadScreenshotWithEvidence: vi.fn(async () => ({
    url: "https://evidence.test/screenshot.png",
    evidence: null,
  })),
}));

describe("POST /api/browserbase/questionnaire-step", () => {
  beforeEach(() => {
    vi.stubEnv("BROWSERBASE_API_KEY", "bb_test_key");
    vi.stubEnv("BROWSERBASE_PROJECT_ID", "bb_test_project");
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.clearAllMocks();
  });

  it("streams browserbase work and persists replayable browser action events", async () => {
    const run = createWorkflowRun({
      id: "run_browserbase_replay",
      orgId: ENTERPRISE_PROOF_ORG_ID,
      workflowKind: "enterprise_proof",
      title: "Questionnaire browser write",
      createdBy: "system",
    });

    const response = await POST(new NextRequest("http://localhost/api/browserbase/questionnaire-step", {
      method: "POST",
      body: JSON.stringify({
        orgId: run.orgId,
        runId: run.id,
        questionId: "soc2_access",
        question: "Do you review access?",
        answer: "Access is reviewed quarterly by the security owner.",
        index: 2,
      }),
    }));

    expect(response.status).toBe(200);
    const streamText = await response.text();
    expect(streamText).toContain("browserbase.field.fill");
    expect(streamText).toContain("fnv1a:");
    expect(streamText).not.toContain("Access is reviewed quarterly");

    const snapshot = await loadRunSnapshot(run.id);
    expect(snapshot?.taskEvents.map((event) => event.kind)).toEqual(expect.arrayContaining([
      "browser_action.session",
      "browser_action.field",
      "browser_action.screenshot",
      "browser_action.paused",
    ]));
    const fillEvent = snapshot?.taskEvents.find((event) =>
      event.kind === "browser_action.field" && event.message.includes("filled")
    );
    expect(fillEvent).toMatchObject({
      actor: "connector",
      capabilityId: "browserbase.write_browser",
      status: "completed",
    });
    expect(JSON.stringify(fillEvent?.payloadSummary)).toContain("soc2_access");
    expect(JSON.stringify(fillEvent?.payloadSummary)).toContain("fnv1a:");
    expect(fillEvent?.payloadSummary).toMatchObject({ answerLength: 51 });
    expect(JSON.stringify(fillEvent?.payloadSummary)).not.toContain("Access is reviewed quarterly");
  });

  it("requires browserbase configuration before opening a session", async () => {
    vi.stubEnv("BROWSERBASE_API_KEY", "");
    vi.stubEnv("BROWSERBASE_PROJECT_ID", "");

    const response = await POST(new NextRequest("http://localhost/api/browserbase/questionnaire-step", {
      method: "POST",
      body: JSON.stringify({
        orgId: ENTERPRISE_PROOF_ORG_ID,
        question: "Do you review access?",
        answer: "Yes.",
      }),
    }));

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "browserbase is not configured",
    });
    expect(response.status).toBe(503);
  });

  it("allows the public enterprise proof demo org even when hosted secrets are configured", async () => {
    vi.stubEnv("QUAD_API_SECRET", "prod_admin_secret");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "prod_service_token:org_other:browser:write");
    vi.stubEnv("QUAD_ALLOWED_ORGS", ENTERPRISE_PROOF_ORG_ID);

    const response = await POST(new NextRequest("http://localhost/api/browserbase/questionnaire-step", {
      method: "POST",
      body: JSON.stringify({
        orgId: ENTERPRISE_PROOF_ORG_ID,
        question: "Do you review access?",
        answer: "Yes.",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("browserbase.session.created");
  });
});
