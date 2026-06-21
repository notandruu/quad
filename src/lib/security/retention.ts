import { countBrainMemories, deleteBrainMemories } from "@/lib/brain";
import { deleteJobs, listJobs } from "@/lib/jobs/queue";
import { deleteQuadChainPackets, getQuadChainPackets } from "@/lib/quad-chain/registry";
import { deleteRunSnapshots, listRunSnapshots } from "@/lib/runs";

export type DeletionScope = "org" | "run";
export type DeletionMode = "dry_run" | "execute";

export type DeletionStore = "workflow_runs" | "quadchain_packets" | "jobs" | "brain_memories";

export type RetentionStorePolicy = {
  store: DeletionStore | "audit_events" | "connector_credentials" | "external_providers";
  contents: string;
  automatic: boolean;
  targetDays: number | null;
  ttlSeconds: number | null;
  deletion: string;
};

export type RetentionPolicy = {
  orgId: string | null;
  configured: boolean;
  retentionDays: number | null;
  source: "org_override" | "global_env" | "missing";
  eventTtlSeconds: number | null;
  generatedAt: string;
  stores: RetentionStorePolicy[];
  deletionModes: Array<{
    scope: DeletionScope;
    supported: boolean;
    confirmationPattern: string;
  }>;
  warnings: string[];
};

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

export function buildRetentionPolicy(input: {
  orgId?: string;
  env?: Record<string, string | undefined>;
  now?: string;
} = {}): RetentionPolicy {
  const env = input.env ?? process.env;
  const orgOverride = input.orgId ? parseOrgRetentionDays(env.QUAD_ORG_RETENTION_DAYS)[input.orgId] ?? null : null;
  const globalRetentionDays = parsePositiveInteger(env.QUAD_RETENTION_DAYS);
  const retentionDays = orgOverride ?? globalRetentionDays;
  const source = orgOverride !== null ? "org_override" : globalRetentionDays !== null ? "global_env" : "missing";
  const eventTtlSeconds = parsePositiveInteger(env.QUAD_AUDIT_EVENT_TTL_SECONDS);
  const configured = retentionDays !== null;
  const warnings = buildRetentionWarnings({
    retentionDays,
    eventTtlSeconds,
    orgId: input.orgId,
    orgOverrideConfigured: orgOverride !== null,
    orgOverrideRaw: env.QUAD_ORG_RETENTION_DAYS,
  });

  return {
    orgId: input.orgId ?? null,
    configured,
    retentionDays,
    source,
    eventTtlSeconds,
    generatedAt: input.now ?? new Date().toISOString(),
    stores: [
      {
        store: "workflow_runs",
        contents: "workflow run snapshots, tasks, artifacts, approvals, and receipts",
        automatic: false,
        targetDays: retentionDays,
        ttlSeconds: null,
        deletion: "deleted by protected org/run deletion receipts",
      },
      {
        store: "quadchain_packets",
        contents: "packet json, certificates, hashes, verification results, and summaries",
        automatic: false,
        targetDays: retentionDays,
        ttlSeconds: null,
        deletion: "deleted by protected org/run/source deletion receipts",
      },
      {
        store: "jobs",
        contents: "queued, running, completed, failed, and dead-lettered worker jobs",
        automatic: false,
        targetDays: retentionDays,
        ttlSeconds: null,
        deletion: "deleted by protected org/run deletion receipts",
      },
      {
        store: "brain_memories",
        contents: "company brain memories, source ids, evidence, entities, permissions, and embeddings",
        automatic: false,
        targetDays: retentionDays,
        ttlSeconds: null,
        deletion: "deleted by protected org/source deletion receipts",
      },
      {
        store: "audit_events",
        contents: "redis live audit events, counters, queue bridges, and packet cache entries",
        automatic: eventTtlSeconds !== null,
        targetDays: eventTtlSeconds ? Math.ceil(eventTtlSeconds / 86400) : null,
        ttlSeconds: eventTtlSeconds,
        deletion: "expires through redis ttl and can also be cleared through run/org deletion where indexed",
      },
      {
        store: "connector_credentials",
        contents: "encrypted connector credential envelopes, scopes, hashes, status, and revocation timestamps",
        automatic: false,
        targetDays: retentionDays,
        ttlSeconds: null,
        deletion: "revoked through connector credential route, then removed through org deletion",
      },
      {
        store: "external_providers",
        contents: "sentry events, arize traces, browserbase sessions, deepgram logs, and model provider telemetry",
        automatic: false,
        targetDays: null,
        ttlSeconds: null,
        deletion: "requires provider console or api deletion outside the quad data plane",
      },
    ],
    deletionModes: [
      {
        scope: "run",
        supported: true,
        confirmationPattern: "delete:<orgId>:<runId>",
      },
      {
        scope: "org",
        supported: true,
        confirmationPattern: "delete:<orgId>",
      },
    ],
    warnings,
  };
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
    "Connector credential revocation is available through /api/connectors/credentials; provider-side oauth invalidation may still require the vendor console.",
  ];
  if (input.scope === "run") {
    warnings.push("Run-scoped deletion does not delete general company brain memories unless sourceId is provided.");
  }
  return warnings;
}

function buildRetentionWarnings(input: {
  retentionDays: number | null;
  eventTtlSeconds: number | null;
  orgId?: string;
  orgOverrideConfigured: boolean;
  orgOverrideRaw?: string;
}): string[] {
  const warnings: string[] = [];
  if (input.retentionDays === null) {
    warnings.push("QUAD_RETENTION_DAYS is missing or invalid; durable stores rely on explicit deletion only.");
  }
  if (input.orgId && input.orgOverrideRaw && !input.orgOverrideConfigured) {
    warnings.push(`No valid QUAD_ORG_RETENTION_DAYS override was found for ${input.orgId}; using global retention policy.`);
  }
  if (input.eventTtlSeconds === null) {
    warnings.push("QUAD_AUDIT_EVENT_TTL_SECONDS is missing or invalid; redis event ttl falls back to runtime defaults.");
  }
  if (input.retentionDays !== null && input.eventTtlSeconds !== null) {
    const targetSeconds = input.retentionDays * 86400;
    if (input.eventTtlSeconds > targetSeconds) {
      warnings.push("QUAD_AUDIT_EVENT_TTL_SECONDS is longer than QUAD_RETENTION_DAYS.");
    }
  }
  warnings.push("External provider retention is not controlled by quad and must be managed in each provider console.");
  return warnings;
}

function parsePositiveInteger(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOrgRetentionDays(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([orgId, value]) => [orgId, parsePositiveInteger(String(value))] as const)
        .filter((entry): entry is readonly [string, number] => Boolean(entry[0]) && entry[1] !== null)
    );
  } catch {
    return {};
  }
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
