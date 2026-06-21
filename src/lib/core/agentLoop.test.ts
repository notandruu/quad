import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { chiefOfStaff } from "@/lib/employees";
import { buildQuadCoreContext } from ".";
import { buildQuadCoreAgentLoop, saveQuadCoreAgentLoopReceipt } from "./agentLoop";

describe("quad core agent loop", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a safe plan, dispatch, observation, and final trace", async () => {
    const context = await buildQuadCoreContext({
      orgId: DEMO_ORG_ID,
      employee: chiefOfStaff,
      text: "audit https://example.com for missing trust proof",
      surface: "chat",
      runId: "run_agent_loop_trace",
      env: {
        BROWSERBASE_API_KEY: "bb_test",
        BROWSERBASE_PROJECT_ID: "proj_test",
      },
      retrieve: async () => [],
      publish: async () => undefined,
    });

    const trace = buildQuadCoreAgentLoop(context, {
      finalMessage: "Starting the audit now.",
    });

    expect(trace).toMatchObject({
      runId: "run_agent_loop_trace",
      surface: "chat",
      intent: "website_audit",
      turnBudget: 4,
      turnsUsed: 4,
      selectedToolIds: expect.arrayContaining(["browserbase.read_browser", "quad.chain_verifier"]),
      blockedToolIds: expect.arrayContaining(["quad.company_brain"]),
    });
    expect(trace.steps.map((step) => step.kind)).toEqual([
      "plan",
      "tool_dispatch",
      "observation",
      "final",
    ]);
    expect(trace.steps[1].toolCalls.map((tool) => tool.id)).toContain("browserbase.read_browser");
    expect(trace.steps[1].toolCalls.find((tool) => tool.id === "quad.company_brain")).toMatchObject({
      status: "blocked",
    });
  });

  it("saves an accepted handoff receipt for the visible loop", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const context = await buildQuadCoreContext({
      orgId: DEMO_ORG_ID,
      employee: chiefOfStaff,
      text: "hello quad",
      surface: "chat",
      runId: "run_agent_loop_receipt",
      env: {},
      retrieve: async () => [],
      publish: async () => undefined,
    });
    const trace = buildQuadCoreAgentLoop(context, { finalMessage: "Got it." });
    const receipt = await saveQuadCoreAgentLoopReceipt(context, trace);

    expect(receipt).toMatchObject({
      type: "agent_handoff",
      accepted: true,
      runId: "run_agent_loop_receipt",
    });
  });
});
