import { getLatestModelCallReceipts, type ModelCallReceipt } from "@/lib/llm/gateway";
import { getLatestRuntimeTraceReceipts, type RuntimeTraceReceipt } from "@/lib/observability";
import type { QuadChainPacket } from "@/lib/quad-chain";
import { getQuadChainPackets, summarizeQuadChainPackets } from "@/lib/quad-chain/registry";
import { listRunSnapshots, type RunLedgerSnapshot } from "@/lib/runs";
import { getEvidenceBundles, type EvidenceBundle } from "@/lib/storage/evidence";

export type UsageMeteringInput = {
  orgId: string;
  runs: RunLedgerSnapshot[];
  packets: QuadChainPacket[];
  evidence: EvidenceBundle[];
  modelReceipts: ModelCallReceipt[];
  runtimeTraces: RuntimeTraceReceipt[];
  generatedAt?: string;
  env?: Record<string, string | undefined>;
};

export type UsageMeteringSnapshot = {
  orgId: string;
  generatedAt: string;
  posture: {
    billingReady: boolean;
    source: "receipt_sample";
    warning: string | null;
  };
  totals: {
    runs: number;
    approvals: number;
    artifacts: number;
    receipts: number;
    connectorActions: number;
    quadchainPackets: number;
    acceptedPackets: number;
    rejectedPackets: number;
    tokensSaved: number;
    evidenceBundles: number;
    evidenceBytes: number;
    modelCalls: number;
    completedModelCalls: number;
    failedModelCalls: number;
    blockedModelCalls: number;
    inputTokens: number;
    outputTokens: number;
    runtimeTraces: number;
    failedRuntimeTraces: number;
    estimatedCostUsd: number;
  };
  byKind: {
    artifacts: Record<string, number>;
    evidence: Record<string, number>;
    runtime: Record<string, number>;
    modelPurpose: Record<string, number>;
  };
};

const DEFAULT_INPUT_USD_PER_1K = 0;
const DEFAULT_OUTPUT_USD_PER_1K = 0;

export async function getUsageMeteringSnapshot(input: {
  orgId: string;
  limit?: number;
  env?: Record<string, string | undefined>;
}): Promise<UsageMeteringSnapshot> {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const [runs, packets, evidence, modelReceipts, runtimeTraces] = await Promise.all([
    listRunSnapshots({ orgId: input.orgId, limit }),
    getQuadChainPackets({ orgId: input.orgId, limit }),
    getEvidenceBundles({ orgId: input.orgId, limit }),
    getLatestModelCallReceipts({ orgId: input.orgId, limit }),
    getLatestRuntimeTraceReceipts({ orgId: input.orgId, limit }),
  ]);

  return summarizeUsageMetering({
    orgId: input.orgId,
    runs,
    packets,
    evidence,
    modelReceipts,
    runtimeTraces,
    env: input.env,
  });
}

export function summarizeUsageMetering(input: UsageMeteringInput): UsageMeteringSnapshot {
  const packetSummary = summarizeQuadChainPackets(input.packets);
  const inputTokens = input.modelReceipts.reduce((total, receipt) => total + (receipt.usage?.inputTokens ?? 0), 0);
  const outputTokens = input.modelReceipts.reduce((total, receipt) => total + (receipt.usage?.outputTokens ?? 0), 0);
  const rates = usageRates(input.env ?? process.env);
  const estimatedCostUsd = roundUsd(
    (inputTokens / 1000) * rates.inputUsdPer1K +
    (outputTokens / 1000) * rates.outputUsdPer1K
  );

  return {
    orgId: input.orgId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    posture: {
      billingReady: (input.env ?? process.env).QUAD_BILLING_METERING_ENABLED === "true",
      source: "receipt_sample",
      warning: rates.configured
        ? null
        : "Token counts are metered, but cost rates are not configured.",
    },
    totals: {
      runs: input.runs.length,
      approvals: input.runs.reduce((total, snapshot) => total + snapshot.approvals.length, 0),
      artifacts: input.runs.reduce((total, snapshot) => total + snapshot.artifacts.length, 0),
      receipts: input.runs.reduce((total, snapshot) => total + snapshot.receipts.length, 0),
      connectorActions: input.runs.reduce(
        (total, snapshot) =>
          total + snapshot.artifacts.filter((artifact) =>
            artifact.kind === "cms_draft" ||
            artifact.kind === "task_draft" ||
            artifact.kind === "trust_packet_export" ||
            artifact.kind === "connector_execution" ||
            artifact.kind === "browser_action"
          ).length,
        0
      ),
      quadchainPackets: packetSummary.total,
      acceptedPackets: packetSummary.accepted,
      rejectedPackets: packetSummary.rejected,
      tokensSaved: packetSummary.tokensSaved,
      evidenceBundles: input.evidence.length,
      evidenceBytes: input.evidence.reduce((total, bundle) => total + bundle.byteLength, 0),
      modelCalls: input.modelReceipts.length,
      completedModelCalls: input.modelReceipts.filter((receipt) => receipt.status === "completed").length,
      failedModelCalls: input.modelReceipts.filter((receipt) => receipt.status === "failed").length,
      blockedModelCalls: input.modelReceipts.filter((receipt) => receipt.status === "blocked").length,
      inputTokens,
      outputTokens,
      runtimeTraces: input.runtimeTraces.length,
      failedRuntimeTraces: input.runtimeTraces.filter((receipt) => receipt.status === "failed").length,
      estimatedCostUsd,
    },
    byKind: {
      artifacts: countBy(input.runs.flatMap((snapshot) => snapshot.artifacts.map((artifact) => artifact.kind))),
      evidence: countBy(input.evidence.map((bundle) => bundle.kind)),
      runtime: countBy(input.runtimeTraces.map((trace) => trace.kind)),
      modelPurpose: countBy(input.modelReceipts.map((receipt) => receipt.purpose)),
    },
  };
}

function usageRates(env: Record<string, string | undefined>) {
  const inputUsdPer1K = parseRate(env.QUAD_METERING_INPUT_USD_PER_1K, DEFAULT_INPUT_USD_PER_1K);
  const outputUsdPer1K = parseRate(env.QUAD_METERING_OUTPUT_USD_PER_1K, DEFAULT_OUTPUT_USD_PER_1K);
  return {
    inputUsdPer1K,
    outputUsdPer1K,
    configured: inputUsdPer1K > 0 || outputUsdPer1K > 0,
  };
}

function parseRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
