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
      task: {
        runId: "run_core_queue_facade",
        status: "queued",
      },
    });
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
