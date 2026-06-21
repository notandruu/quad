import { afterEach, describe, expect, it, vi } from "vitest";
import { getLatestModelCallReceipts, runTextModelCall } from "./gateway";

describe("model gateway", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records a safe completed receipt with retries and redaction counts", async () => {
    vi.stubEnv("QUAD_MODEL_RETRY_DELAY_MS", "0");
    let calls = 0;

    const result = await runTextModelCall({
      orgId: "org_gateway",
      runId: "run_gateway_complete",
      provider: "anthropic",
      model: "claude-test",
      purpose: "chat",
      system: "internal support email ceo@example.com",
      prompt: "confidential customer question from buyer@example.com",
      maxTokens: 100,
      execute: async () => {
        calls += 1;
        if (calls === 1) throw new Error("temporary upstream error");
        return {
          text: "safe answer",
          usage: { inputTokens: 12, outputTokens: 3 },
        };
      },
    });
    const [receipt] = await getLatestModelCallReceipts({ orgId: "org_gateway", runId: "run_gateway_complete" });
    const serialized = JSON.stringify(receipt);

    expect(result.text).toBe("safe answer");
    expect(calls).toBe(2);
    expect(receipt).toMatchObject({
      status: "completed",
      attempts: 2,
      provider: "anthropic",
      model: "claude-test",
      purpose: "chat",
      usage: {
        inputTokens: 12,
        outputTokens: 3,
      },
    });
    expect(receipt.input.redactionCount).toBeGreaterThan(0);
    expect(receipt.input.promptHash).toMatch(/^fnv1a:/);
    expect(receipt.output.hash).toMatch(/^fnv1a:/);
    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("ceo@example.com");
    expect(serialized).not.toContain("safe answer");
  });

  it("records skipped provider receipts when no client is configured", async () => {
    const result = await runTextModelCall({
      orgId: "org_gateway",
      runId: "run_gateway_skipped",
      provider: "anthropic",
      model: "claude-test",
      purpose: "audit",
      prompt: "public page text",
      maxTokens: 100,
      execute: null,
    });

    expect(result.text).toBeNull();
    expect(result.receipt).toMatchObject({
      status: "skipped",
      attempts: 0,
      reason: "Provider client is not configured.",
    });
  });

  it("records blocked receipts before throwing on restricted payloads", async () => {
    await expect(runTextModelCall({
      orgId: "org_gateway",
      runId: "run_gateway_blocked",
      provider: "anthropic",
      model: "claude-test",
      purpose: "audit",
      prompt: "password=supersecretvalue",
      maxTokens: 100,
      execute: async () => ({ text: "should not run" }),
    })).rejects.toThrow("Restricted data");

    const [receipt] = await getLatestModelCallReceipts({ orgId: "org_gateway", runId: "run_gateway_blocked" });
    expect(receipt).toMatchObject({
      status: "blocked",
      attempts: 0,
      output: {
        hash: null,
        chars: 0,
      },
    });
    expect(JSON.stringify(receipt)).not.toContain("supersecretvalue");
  });
});
