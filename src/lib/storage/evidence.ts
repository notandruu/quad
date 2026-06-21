import { eventTtlSeconds, getRedis } from "@/lib/redis";
import { tenantKey, type DataClassification } from "@/lib/security";

export type EvidenceBundleKind = "screenshot" | "voice_audio" | "trust_packet_export" | "browser_action";
export type EvidenceBundleStorageMode = "supabase_storage" | "inline_fallback" | "external_provider" | "artifact_payload";
export type EvidenceBundleVisibility = "public" | "internal" | "restricted";

export type EvidenceBundle = {
  id: string;
  orgId: string;
  runId: string;
  kind: EvidenceBundleKind;
  storageMode: EvidenceBundleStorageMode;
  visibility: EvidenceBundleVisibility;
  classification: DataClassification;
  mimeType: string;
  byteLength: number;
  hash: string;
  publicUrl: string | null;
  storageKey: string | null;
  sourceUrl: string | null;
  createdAt: string;
  retention: {
    ttlSeconds: number;
    deleteWithRun: boolean;
  };
  metadata: Record<string, string | number | boolean | null>;
};

export type EvidenceBundleSummary = Pick<
  EvidenceBundle,
  | "id"
  | "orgId"
  | "runId"
  | "kind"
  | "storageMode"
  | "visibility"
  | "classification"
  | "mimeType"
  | "byteLength"
  | "hash"
  | "publicUrl"
  | "storageKey"
  | "sourceUrl"
  | "createdAt"
  | "retention"
> & {
  metadataKeys: string[];
};

export type CreateEvidenceBundleInput = {
  orgId: string;
  runId: string;
  kind: EvidenceBundleKind;
  storageMode: EvidenceBundleStorageMode;
  mimeType: string;
  byteLength: number;
  bytes?: Buffer | ArrayBuffer | Uint8Array;
  text?: string;
  publicUrl?: string | null;
  storageKey?: string | null;
  sourceUrl?: string | null;
  visibility?: EvidenceBundleVisibility;
  classification?: DataClassification;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  now?: string;
};

const g = globalThis as typeof globalThis & {
  __quadEvidenceBundles?: Map<string, EvidenceBundle>;
};
if (!g.__quadEvidenceBundles) g.__quadEvidenceBundles = new Map();
const memoryBundles = g.__quadEvidenceBundles;

export async function createEvidenceBundle(input: CreateEvidenceBundleInput): Promise<EvidenceBundle> {
  const bundle: EvidenceBundle = {
    id: `evidence_${crypto.randomUUID()}`,
    orgId: input.orgId,
    runId: input.runId,
    kind: input.kind,
    storageMode: input.storageMode,
    visibility: input.visibility ?? defaultVisibility(input.kind),
    classification: input.classification ?? defaultClassification(input.kind),
    mimeType: input.mimeType,
    byteLength: Math.max(0, input.byteLength),
    hash: hashEvidence(input),
    publicUrl: input.storageMode === "inline_fallback" ? null : input.publicUrl ?? null,
    storageKey: input.storageKey ?? null,
    sourceUrl: input.sourceUrl ?? null,
    createdAt: input.now ?? new Date().toISOString(),
    retention: {
      ttlSeconds: eventTtlSeconds(),
      deleteWithRun: true,
    },
    metadata: cleanMetadata(input.metadata),
  };

  memoryBundles.set(bundle.id, bundle);
  pruneMemoryBundles();
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(evidenceKey(bundle.orgId, bundle.id), bundle, { ex: bundle.retention.ttlSeconds });
    } catch {
      // Memory bundle remains available for local/operator summaries.
    }
  }
  return bundle;
}

export async function getEvidenceBundles(input: {
  orgId?: string;
  runId?: string;
  kind?: EvidenceBundleKind;
  limit?: number;
} = {}): Promise<EvidenceBundle[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  return [...memoryBundles.values()]
    .filter((bundle) => !input.orgId || bundle.orgId === input.orgId)
    .filter((bundle) => !input.runId || bundle.runId === input.runId)
    .filter((bundle) => !input.kind || bundle.kind === input.kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function summarizeEvidenceBundle(bundle: EvidenceBundle): EvidenceBundleSummary {
  return {
    id: bundle.id,
    orgId: bundle.orgId,
    runId: bundle.runId,
    kind: bundle.kind,
    storageMode: bundle.storageMode,
    visibility: bundle.visibility,
    classification: bundle.classification,
    mimeType: bundle.mimeType,
    byteLength: bundle.byteLength,
    hash: bundle.hash,
    publicUrl: bundle.publicUrl,
    storageKey: bundle.storageKey,
    sourceUrl: bundle.sourceUrl,
    createdAt: bundle.createdAt,
    retention: bundle.retention,
    metadataKeys: Object.keys(bundle.metadata).sort(),
  };
}

export function summarizeEvidenceBundles(bundles: EvidenceBundle[]) {
  return {
    total: bundles.length,
    public: bundles.filter((bundle) => bundle.visibility === "public").length,
    internal: bundles.filter((bundle) => bundle.visibility === "internal").length,
    restricted: bundles.filter((bundle) => bundle.visibility === "restricted").length,
    byKind: bundles.reduce<Record<string, number>>((acc, bundle) => {
      acc[bundle.kind] = (acc[bundle.kind] ?? 0) + 1;
      return acc;
    }, {}),
    latest: bundles.slice(0, 8).map(summarizeEvidenceBundle),
  };
}

function hashEvidence(input: CreateEvidenceBundleInput): string {
  if (input.bytes) return hashBytes(input.bytes);
  if (input.text !== undefined) return hashBytes(Buffer.from(input.text));
  return hashBytes(Buffer.from(`${input.kind}:${input.publicUrl ?? ""}:${input.storageKey ?? ""}:${input.byteLength}`));
}

function hashBytes(value: Buffer | ArrayBuffer | Uint8Array): string {
  const bytes = Buffer.isBuffer(value)
    ? value
    : value instanceof ArrayBuffer
      ? Buffer.from(value)
      : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function defaultVisibility(kind: EvidenceBundleKind): EvidenceBundleVisibility {
  if (kind === "voice_audio") return "restricted";
  return "internal";
}

function defaultClassification(kind: EvidenceBundleKind): DataClassification {
  if (kind === "voice_audio") return "confidential";
  return "internal";
}

function cleanMetadata(input: CreateEvidenceBundleInput["metadata"]): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined) continue;
    if (!/^[a-zA-Z0-9_.:-]{1,80}$/.test(key)) continue;
    out[key] = typeof value === "string" ? value.slice(0, 240) : value;
  }
  return out;
}

function evidenceKey(orgId: string, evidenceId: string): string {
  return tenantKey(orgId, "evidence", evidenceId);
}

function pruneMemoryBundles(): void {
  if (memoryBundles.size <= 250) return;
  const oldest = [...memoryBundles.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (oldest) memoryBundles.delete(oldest.id);
}
