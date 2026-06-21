import type { BrainMemory } from "@/lib/types";
import { canReadMemory, normalizeMemoryPermissions, type BrainMemoryVisibility } from "./permissions";

export type BrainMemoryValidationStatus = "unverified" | "verified" | "approved";
export type BrainMemoryFreshness = "fresh" | "stale" | "unknown";
export type BrainMemoryRelationshipKind = "supports" | "updates" | "derived_from" | "duplicates" | "supersedes";

export type BrainMemoryRelationship = {
  kind: BrainMemoryRelationshipKind;
  sourceId: string;
  label?: string;
};

export type BrainMemoryMetadata = {
  visibility: BrainMemoryVisibility;
  ownerUserId: string | null;
  teamIds: string[];
  validationStatus: BrainMemoryValidationStatus;
  sourceUpdatedAt: string | null;
  staleAfter: string | null;
  freshness: BrainMemoryFreshness;
  relationships: BrainMemoryRelationship[];
};

export type BrainMemoryMetadataInput = {
  visibility?: BrainMemoryVisibility;
  userId?: string;
  teamId?: string;
  teamIds?: string[];
  ownerUserId?: string | null;
  validationStatus?: BrainMemoryValidationStatus;
  sourceUpdatedAt?: string | null;
  staleAfter?: string | null;
  relationships?: BrainMemoryRelationship[];
  relatedSourceIds?: string[];
};

const g = globalThis as typeof globalThis & {
  __quadBrainMemoryMetadata?: Map<string, BrainMemoryMetadata>;
};
if (!g.__quadBrainMemoryMetadata) g.__quadBrainMemoryMetadata = new Map();
const metadataStore = g.__quadBrainMemoryMetadata;

export function normalizeMemoryMetadata(
  input: BrainMemoryMetadataInput & { permissions?: string[] },
  now: string = new Date().toISOString()
): BrainMemoryMetadata {
  const permissions = normalizeMemoryPermissions(input);
  const access = canReadMemory({ permissions });
  const relationships = [
    ...(input.relationships ?? []),
    ...(input.relatedSourceIds ?? []).map((sourceId) => ({
      kind: "derived_from" as const,
      sourceId,
    })),
  ];

  return {
    visibility: input.visibility ?? access.visibility,
    ownerUserId: normalizeNullable(input.ownerUserId ?? input.userId ?? access.ownerUserId),
    teamIds: unique([
      ...access.teamIds,
      ...(input.teamIds ?? []),
      ...(input.teamId ? [input.teamId] : []),
    ]),
    validationStatus: input.validationStatus ?? "approved",
    sourceUpdatedAt: normalizeDate(input.sourceUpdatedAt) ?? now,
    staleAfter: normalizeDate(input.staleAfter),
    freshness: computeFreshness(input.staleAfter, now),
    relationships: normalizeRelationships(relationships),
  };
}

export function saveMemoryMetadata(memoryId: string, metadata: BrainMemoryMetadata): void {
  metadataStore.set(memoryId, metadata);
}

export function getMemoryMetadata(memory: BrainMemory, raw?: unknown, now: string = new Date().toISOString()): BrainMemoryMetadata {
  const fromMemory = metadataStore.get(memory.id);
  if (fromMemory) return refreshMemoryMetadata(fromMemory, now);
  const parsed = parseMemoryMetadata(raw);
  if (parsed) return refreshMemoryMetadata(parsed, now);
  return normalizeMemoryMetadata({ permissions: memory.permissions }, now);
}

export function parseMemoryMetadata(raw: unknown): BrainMemoryMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<BrainMemoryMetadata>;
  const visibility = isVisibility(value.visibility) ? value.visibility : undefined;
  return normalizeMemoryMetadata({
    visibility,
    ownerUserId: normalizeNullable(value.ownerUserId),
    teamIds: Array.isArray(value.teamIds) ? value.teamIds.map(String) : [],
    validationStatus: isValidationStatus(value.validationStatus) ? value.validationStatus : undefined,
    sourceUpdatedAt: normalizeDate(value.sourceUpdatedAt),
    staleAfter: normalizeDate(value.staleAfter),
    relationships: Array.isArray(value.relationships) ? normalizeRelationships(value.relationships) : [],
  });
}

export function refreshMemoryMetadata(metadata: BrainMemoryMetadata, now: string = new Date().toISOString()): BrainMemoryMetadata {
  return {
    ...metadata,
    freshness: computeFreshness(metadata.staleAfter, now),
  };
}

function computeFreshness(staleAfter: string | null | undefined, now: string): BrainMemoryFreshness {
  const staleAt = Date.parse(staleAfter ?? "");
  if (!Number.isFinite(staleAt)) return "unknown";
  const nowMs = Date.parse(now);
  return Number.isFinite(nowMs) && nowMs > staleAt ? "stale" : "fresh";
}

function normalizeRelationships(values: unknown[]): BrainMemoryRelationship[] {
  return values
    .map((value): BrainMemoryRelationship | null => {
      if (!value || typeof value !== "object") return null;
      const item = value as Partial<BrainMemoryRelationship>;
      if (!item.sourceId || !isRelationshipKind(item.kind)) return null;
      const relationship: BrainMemoryRelationship = {
        kind: item.kind,
        sourceId: String(item.sourceId),
      };
      if (item.label) relationship.label = String(item.label);
      return relationship;
    })
    .filter((item): item is BrainMemoryRelationship => Boolean(item));
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function isVisibility(value: unknown): value is BrainMemoryVisibility {
  return value === "company" || value === "team" || value === "personal";
}

function isValidationStatus(value: unknown): value is BrainMemoryValidationStatus {
  return value === "unverified" || value === "verified" || value === "approved";
}

function isRelationshipKind(value: unknown): value is BrainMemoryRelationshipKind {
  return value === "supports" || value === "updates" || value === "derived_from" || value === "duplicates" || value === "supersedes";
}
