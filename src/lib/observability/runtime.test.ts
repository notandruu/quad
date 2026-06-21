import { describe, expect, it } from "vitest";
import { getLatestRuntimeTraceReceipts, summarizeRuntimeTraceReceipts, withRuntimeTrace } from "./runtime";

describe("runtime trace receipts", () => {
  it("records completed traces without raw payloads", async () => {
    const result = await withRuntimeTrace({
      name: "enterprise_proof.answer_trust_question",
      kind: "workflow",
      orgId: "org_runtime_trace",
      runId: "run_runtime_trace",
      attributes: {
        questionLength: 42,
        secret: undefined,
      },
    }, async () => "ok");

    const [receipt] = await getLatestRuntimeTraceReceipts({
      orgId: "org_runtime_trace",
      runId: "run_runtime_trace",
    });

    expect(result).toBe("ok");
    expect(receipt).toMatchObject({
      name: "enterprise_proof.answer_trust_question",
      kind: "workflow",
      status: "completed",
      attributes: {
        questionLength: 42,
      },
    });
    expect(receipt.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(receipt)).not.toContain("supersecretvalue");
  });

  it("records failed traces with error class and summaries", async () => {
    await expect(withRuntimeTrace({
      name: "worker.audit",
      kind: "worker_job",
      orgId: "org_runtime_trace",
      runId: "run_runtime_failed",
      attributes: {
        jobType: "audit",
      },
    }, async () => {
      throw new TypeError("worker exploded");
    })).rejects.toThrow("worker exploded");

    const [receipt] = await getLatestRuntimeTraceReceipts({
      orgId: "org_runtime_trace",
      runId: "run_runtime_failed",
    });
    const summary = summarizeRuntimeTraceReceipts([receipt]);

    expect(receipt).toMatchObject({
      status: "failed",
      errorClass: "TypeError",
      reason: "worker exploded",
    });
    expect(summary).toMatchObject({
      total: 1,
      completed: 0,
      failed: 1,
    });
  });
});
