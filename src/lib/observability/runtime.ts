import { eventTtlSeconds, getRedis, tenantScopedKeys } from "@/lib/redis";
import { traced } from "./phoenix";
import { withSpan, type QuadSpanTags } from "./sentry";

export type RuntimeTraceKind =
  | "workflow"
  | "route"
  | "worker_job"
  | "tool"
  | "model"
  | "connector";

export type RuntimeTraceStatus = "completed" | "failed";

export type RuntimeTraceReceipt = {
  id: string;
  name: string;
  kind: RuntimeTraceKind;
  orgId: string;
  runId?: string;
  status: RuntimeTraceStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  attributes: Record<string, string | number | boolean | null>;
  errorClass?: string;
  reason: string;
};

export type RuntimeTraceSummary = {
  total: number;
  completed: number;
  failed: number;
  averageDurationMs: number;
  latest: Array<Pick<
    RuntimeTraceReceipt,
    "id" | "name" | "kind" | "orgId" | "runId" | "status" | "durationMs" | "completedAt" | "errorClass" | "reason"
  >>;
};

export type RuntimeTraceInput = {
  name: string;
  kind: RuntimeTraceKind;
  orgId: string;
  runId?: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  tags?: QuadSpanTags;
};

const g = globalThis as typeof globalThis & {
  __quadRuntimeTraceReceipts?: Map<string, RuntimeTraceReceipt>;
};
if (!g.__quadRuntimeTraceReceipts) g.__quadRuntimeTraceReceipts = new Map();
const memoryReceipts = g.__quadRuntimeTraceReceipts;

export async function withRuntimeTrace<T>(
  input: RuntimeTraceInput,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = new Date();
  const attributes = cleanAttributes(input.attributes ?? {});
  const sentryTags: QuadSpanTags = {
    orgId: hashForTelemetry(input.orgId),
    runId: input.runId,
    ...input.tags,
  };

  try {
    const result = await withSpan(input.name, sentryTags, () =>
      traced(
        input.name,
        {
          "quad.org_hash": hashForTelemetry(input.orgId),
          "quad.run_id": input.runId ?? "none",
          "quad.trace_kind": input.kind,
          ...prefixAttributes(attributes),
        },
        async () => fn()
      )
    );
    await saveRuntimeTraceReceipt({
      id: `trace_${crypto.randomUUID()}`,
      name: input.name,
      kind: input.kind,
      orgId: input.orgId,
      runId: input.runId,
      status: "completed",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      attributes,
      reason: "Runtime operation completed.",
    });
    return result;
  } catch (error) {
    await saveRuntimeTraceReceipt({
      id: `trace_${crypto.randomUUID()}`,
      name: input.name,
      kind: input.kind,
      orgId: input.orgId,
      runId: input.runId,
      status: "failed",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      attributes,
      errorClass: errorName(error),
      reason: error instanceof Error ? error.message : "Runtime operation failed.",
    });
    throw error;
  }
}

export async function getLatestRuntimeTraceReceipts(input: {
  orgId?: string;
  runId?: string;
  kind?: RuntimeTraceKind;
  limit?: number;
} = {}): Promise<RuntimeTraceReceipt[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  return [...memoryReceipts.values()]
    .filter((receipt) => !input.orgId || receipt.orgId === input.orgId)
    .filter((receipt) => !input.runId || receipt.runId === input.runId)
    .filter((receipt) => !input.kind || receipt.kind === input.kind)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}

export function summarizeRuntimeTraceReceipts(receipts: RuntimeTraceReceipt[]): RuntimeTraceSummary {
  const totalDuration = receipts.reduce((sum, receipt) => sum + receipt.durationMs, 0);
  return {
    total: receipts.length,
    completed: receipts.filter((receipt) => receipt.status === "completed").length,
    failed: receipts.filter((receipt) => receipt.status === "failed").length,
    averageDurationMs: receipts.length > 0 ? Math.round(totalDuration / receipts.length) : 0,
    latest: receipts.slice(0, 10).map((receipt) => ({
      id: receipt.id,
      name: receipt.name,
      kind: receipt.kind,
      orgId: receipt.orgId,
      runId: receipt.runId,
      status: receipt.status,
      durationMs: receipt.durationMs,
      completedAt: receipt.completedAt,
      errorClass: receipt.errorClass,
      reason: receipt.reason,
    })),
  };
}

async function saveRuntimeTraceReceipt(receipt: RuntimeTraceReceipt): Promise<RuntimeTraceReceipt> {
  memoryReceipts.set(receipt.id, receipt);
  pruneMemoryReceipts();

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(tenantScopedKeys.modelCall(receipt.orgId, receipt.id), receipt, { ex: eventTtlSeconds() });
    } catch {
      // Memory receipts still preserve local observability in demo mode.
    }
  }

  return receipt;
}

function cleanAttributes(attributes: Record<string, string | number | boolean | null | undefined>) {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value ?? null])
  ) as Record<string, string | number | boolean | null>;
}

function prefixAttributes(attributes: Record<string, string | number | boolean | null>) {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [`quad.${key}`, value ?? "null"])
  ) as Record<string, string | number | boolean>;
}

function hashForTelemetry(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "Error";
}

function pruneMemoryReceipts(): void {
  if (memoryReceipts.size <= 250) return;
  const oldest = [...memoryReceipts.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0];
  if (oldest) memoryReceipts.delete(oldest.id);
}
