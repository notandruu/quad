import { describe, expect, it } from "vitest";
import { addArtifact, createReceipt, createWorkflowRun, getRunSnapshot } from "@/lib/runs";
import type { ModelCallReceipt } from "@/lib/llm/gateway";
import type { RuntimeTraceReceipt } from "@/lib/observability";
import type { EvidenceBundle } from "@/lib/storage/evidence";
import { summarizeUsageMetering } from ".";

describe("usage metering", () => {
  it("summarizes receipt-derived usage without raw payload content", () => {
    const run = createWorkflowRun({
      id: `run_usage_${crypto.randomUUID()}`,
      orgId: "org_usage",
      workflowKind: "trust_packet",
      title: "Usage run",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });
    const draft = addArtifact({
      runId: run.id,
      kind: "cms_draft",
      title: "Cms draft",
      data: { rawSecret: "sk-ant-test-secret", body: "customer private answer" },
      now: "2026-06-21T00:00:01.000Z",
    });
    createReceipt({
      runId: run.id,
      artifactId: draft.id,
      status: "ready",
      summary: "Draft staged.",
      now: "2026-06-21T00:00:02.000Z",
    });

    const snapshot = getRunSnapshot(run.id)!;
    const usage = summarizeUsageMetering({
      orgId: "org_usage",
      runs: [snapshot],
      packets: [],
      evidence: [
        {
          orgId: "org_usage",
          runId: run.id,
          id: "evidence_usage",
          kind: "browser_action",
          storageMode: "external_provider",
          visibility: "internal",
          classification: "internal",
          mimeType: "application/json",
          byteLength: 1200,
          hash: "fnv1a:evidence",
          publicUrl: null,
          storageKey: "run/evidence.json",
          sourceUrl: "https://example.com",
          createdAt: "2026-06-21T00:00:03.000Z",
          retention: { ttlSeconds: 86400, deleteWithRun: true },
          metadata: { phase: "after" },
        } satisfies EvidenceBundle,
      ],
      modelReceipts: [
        modelReceipt({ status: "completed", inputTokens: 2000, outputTokens: 500 }),
        modelReceipt({ status: "blocked", inputTokens: 0, outputTokens: 0 }),
      ],
      runtimeTraces: [
        runtimeTrace({ kind: "workflow", status: "completed" }),
        runtimeTrace({ kind: "connector", status: "failed" }),
      ],
      generatedAt: "2026-06-21T00:00:04.000Z",
      env: {
        QUAD_BILLING_METERING_ENABLED: "true",
        QUAD_METERING_INPUT_USD_PER_1K: "0.002",
        QUAD_METERING_OUTPUT_USD_PER_1K: "0.01",
      },
    });

    expect(usage).toMatchObject({
      orgId: "org_usage",
      posture: { billingReady: true, warning: null },
      totals: {
        runs: 1,
        artifacts: 1,
        receipts: 1,
        connectorActions: 1,
        evidenceBundles: 1,
        evidenceBytes: 1200,
        modelCalls: 2,
        completedModelCalls: 1,
        blockedModelCalls: 1,
        inputTokens: 2000,
        outputTokens: 500,
        runtimeTraces: 2,
        failedRuntimeTraces: 1,
        estimatedCostUsd: 0.009,
      },
      byKind: {
        artifacts: { cms_draft: 1 },
        evidence: { browser_action: 1 },
        runtime: { workflow: 1, connector: 1 },
        modelPurpose: { chat: 2 },
      },
    });
    expect(JSON.stringify(usage)).not.toMatch(/sk-ant-test-secret|customer private answer/);
  });
});

function modelReceipt(input: {
  status: ModelCallReceipt["status"];
  inputTokens: number;
  outputTokens: number;
}): ModelCallReceipt {
  return {
    id: `model_${crypto.randomUUID()}`,
    orgId: "org_usage",
    provider: "anthropic",
    model: "claude-opus-4-8",
    purpose: "chat",
    status: input.status,
    createdAt: "2026-06-21T00:00:00.000Z",
    completedAt: "2026-06-21T00:00:01.000Z",
    durationMs: 100,
    attempts: input.status === "completed" ? 1 : 0,
    maxAttempts: 2,
    input: {
      promptHash: "fnv1a:prompt",
      systemHash: null,
      originalChars: 100,
      sanitizedChars: 80,
      redactionCount: 1,
      classifications: ["internal"],
    },
    output: {
      hash: input.status === "completed" ? "fnv1a:output" : null,
      chars: input.status === "completed" ? 300 : 0,
    },
    usage: {
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    },
    reason: "test receipt",
  };
}

function runtimeTrace(input: {
  kind: RuntimeTraceReceipt["kind"];
  status: RuntimeTraceReceipt["status"];
}): RuntimeTraceReceipt {
  return {
    id: `trace_${crypto.randomUUID()}`,
    name: `${input.kind}.test`,
    kind: input.kind,
    orgId: "org_usage",
    status: input.status,
    startedAt: "2026-06-21T00:00:00.000Z",
    completedAt: "2026-06-21T00:00:01.000Z",
    durationMs: 120,
    attributes: {},
    reason: "test trace",
  };
}
