import { countBrainMemories, deleteBrainMemories } from "@/lib/brain";
import { deleteJobs, listJobs } from "@/lib/jobs/queue";
import { deleteQuadChainPackets, getQuadChainPackets } from "@/lib/quad-chain/registry";
import { deleteRunSnapshots, listRunSnapshots } from "@/lib/runs";

export type DeletionScope = "org" | "run";
export type DeletionMode = "dry_run" | "execute";

export type DeletionStore = "workflow_runs" | "quadchain_packets" | "jobs" | "brain_memories";

export type DeletionStoreResult = {
  store: DeletionStore;
  matched: number;
  deleted: number;
  mode: DeletionMode;
};

export type DataDeletionRequest = {
  orgId: string;
  scope: DeletionScope;
  mode: DeletionMode;
  runId?: string;
  sourceId?: string;
  requestedBy?: string;
  confirmation?: string;
  now?: string;
};

export type DataDeletionReceipt = {
  id: string;
  orgId: string;
  scope: DeletionScope;
  mode: DeletionMode;
  runId: string | null;
  sourceId: string | null;
  requestedBy: string;
  createdAt: string;
  requiredConfirmation: string;
  executed: boolean;
  stores: DeletionStoreResult[];
  warnings: string[];
};

export class DataDeletionError extends Error {
  constructor(
    message: string,
    public readonly code: "run_required" | "confirmation_required",
    public readonly status: 400 | 409
  ) {
    super(message);
  }
}

export async function buildDataDeletionReceipt(input: DataDeletionRequest): Promise<DataDeletionReceipt> {
  if (input.scope === "run" && !input.runId) {
    throw new DataDeletionError("runId is required for run-scoped deletion.", "run_required", 400);
  }

  const requiredConfirmation = confirmationFor(input);
  if (input.mode === "execute" && input.confirmation !== requiredConfirmation) {
    throw new DataDeletionError(
      `Confirmation must equal ${requiredConfirmation}.`,
      "confirmation_required",
      409
    );
  }

  const matched = await countDeletionTargets(input);
  const stores = input.mode === "execute"
    ? await executeDeletion(input, matched)
    : matched.map((item) => ({ ...item, deleted: 0, mode: "dry_run" as const }));

  return {
    id: `deletion_${hashParts(input.orgId, input.scope, input.runId ?? "org", input.now ?? new Date().toISOString())}`,
    orgId: input.orgId,
    scope: input.scope,
    mode: input.mode,
    runId: input.runId ?? null,
    sourceId: input.sourceId ?? null,
    requestedBy: input.requestedBy ?? "demo.operator",
    createdAt: input.now ?? new Date().toISOString(),
    requiredConfirmation,
    executed: input.mode === "execute",
    stores,
    warnings: buildDeletionWarnings(input),
  };
}

export function confirmationFor(input: Pick<DataDeletionRequest, "scope" | "orgId" | "runId">): string {
  return input.scope === "run" ? `delete:${input.orgId}:${input.runId}` : `delete:${input.orgId}`;
}

async function countDeletionTargets(input: DataDeletionRequest): Promise<Array<Omit<DeletionStoreResult, "deleted" | "mode">>> {
  const [runs, packets, jobs, memories] = await Promise.all([
    listRunSnapshots({ orgId: input.orgId, limit: 100 }),
    getQuadChainPackets({ orgId: input.orgId, runId: input.runId, sourceId: input.sourceId, limit: 100 }),
    listJobs({ orgId: input.orgId, limit: 100 }),
    countBrainMemories({ orgId: input.orgId, sourceId: input.sourceId }),
  ]);

  return [
    {
      store: "workflow_runs",
      matched: runs.filter((snapshot) => !input.runId || snapshot.run.id === input.runId).length,
    },
    {
      store: "quadchain_packets",
      matched: packets.length,
    },
    {
      store: "jobs",
      matched: jobs.filter((job) => !input.runId || job.runId === input.runId).length,
    },
    {
      store: "brain_memories",
      matched: input.scope === "org" || input.sourceId ? memories : 0,
    },
  ];
}

async function executeDeletion(
  input: DataDeletionRequest,
  matched: Array<Omit<DeletionStoreResult, "deleted" | "mode">>
): Promise<DeletionStoreResult[]> {
  const [deletedRuns, deletedPackets, deletedJobs, deletedMemories] = await Promise.all([
    deleteRunSnapshots({ orgId: input.orgId, runId: input.runId }),
    deleteQuadChainPackets({ orgId: input.orgId, runId: input.runId, sourceId: input.sourceId }),
    deleteJobs({ orgId: input.orgId, runId: input.runId }),
    input.scope === "org" || input.sourceId
      ? deleteBrainMemories({ orgId: input.orgId, sourceId: input.sourceId })
      : Promise.resolve(0),
  ]);
  const deletedByStore: Record<DeletionStore, number> = {
    workflow_runs: deletedRuns,
    quadchain_packets: deletedPackets,
    jobs: deletedJobs,
    brain_memories: deletedMemories,
  };

  return matched.map((item) => ({
    ...item,
    deleted: deletedByStore[item.store],
    mode: "execute",
  }));
}

function buildDeletionWarnings(input: DataDeletionRequest): string[] {
  const warnings = [
    "External provider logs, Sentry events, Arize traces, and Browserbase session history may require deletion in their own consoles.",
    "Connector token revocation is not part of this deletion receipt yet.",
  ];
  if (input.scope === "run") {
    warnings.push("Run-scoped deletion does not delete general company brain memories unless sourceId is provided.");
  }
  return warnings;
}

function hashParts(...parts: string[]): string {
  let hash = 2166136261;
  const value = parts.join(":");
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
