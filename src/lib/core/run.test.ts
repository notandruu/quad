import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { runQuadCoreCommand } from "./run";

describe("quad core run facade", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs normal chat through the shared runtime facade", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("KALI_CHAT_MODEL", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const result = await runQuadCoreCommand({
      command: "chat",
      orgId: DEMO_ORG_ID,
      runId: "run_core_chat_facade",
      text: "hello quad",
      surface: "chat",
    });

    expect(result).toMatchObject({
      ok: true,
      command: "chat",
      orgId: DEMO_ORG_ID,
      runId: "run_core_chat_facade",
      surface: "chat",
      intent: "general_chat",
      requiresApproval: false,
    });
    expect(result.command).toBe("chat");
    if (result.command !== "chat") throw new Error("expected chat result");
    expect(result.message).toContain("Retrieved");
    expect(result.quadChain).toMatchObject({
      type: "chat_answer",
      accepted: true,
    });
    expect(result.agentLoop).toMatchObject({
      intent: "general_chat",
      turnsUsed: 4,
      quadChain: {
        type: "agent_handoff",
        accepted: true,
      },
    });
    expect(result.agentLoop.steps.map((step) => step.kind)).toEqual([
      "plan",
      "tool_dispatch",
      "observation",
      "final",
    ]);
  });

  it("queues audit work through the same facade", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const result = await runQuadCoreCommand({
      command: "queue_audit",
      orgId: DEMO_ORG_ID,
      runId: "run_core_queue_facade",
      targetUrl: "https://example.com",
      surface: "dashboard",
      limit: 2,
    });

    expect(result).toMatchObject({
      ok: true,
      command: "queue_audit",
      orgId: DEMO_ORG_ID,
      runId: "run_core_queue_facade",
      mode: "memory",
      job: {
        type: "audit",
        status: "queued",
      },
      quadChain: [
        {
          type: "agent_handoff",
          accepted: true,
        },
      ],
      runtime: {
        surface: "dashboard",
      },
      task: {
        runId: "run_core_queue_facade",
        status: "queued",
      },
      agentLoop: {
        surface: "dashboard",
        intent: "website_audit",
        quadChain: {
          type: "agent_handoff",
          accepted: true,
        },
      },
    });
    expect(result.command).toBe("queue_audit");
    if (result.command !== "queue_audit") throw new Error("expected queue result");
    expect(result.runtime.selectedTools).toContain("quad.chain_verifier");
  });

  it("rejects missing command payloads before creating runtime work", async () => {
    await expect(runQuadCoreCommand({
      command: "chat",
      orgId: DEMO_ORG_ID,
      text: "",
    })).rejects.toThrow("text required");

    await expect(runQuadCoreCommand({
      command: "queue_audit",
      orgId: DEMO_ORG_ID,
    })).rejects.toThrow("targetUrl required");
  });
});
