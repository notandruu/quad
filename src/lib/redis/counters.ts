import { getRedis, eventTtlSeconds } from "./client";
import { counterKeys, metaKeys, tenantScopedKeys, type CounterName } from "./keys";
import type { AuditRun } from "@/lib/types";

/**
 * Increment a live progress counter for an audit run. The UI animates these
 * upward as the worker reports progress.
 */
export async function bumpCounter(
  runId: string,
  name: CounterName,
  by = 1,
  orgId?: string
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;

  const key = counterKey(name, runId, orgId);
  const value = await redis.incrby(key, by);
  await redis.expire(key, eventTtlSeconds());
  return value;
}

export async function readCounters(
  runId: string,
  orgId?: string
): Promise<Record<CounterName, number>> {
  const redis = getRedis();
  const names = Object.keys(counterKeys) as CounterName[];
  const empty = Object.fromEntries(names.map((n) => [n, 0])) as Record<
    CounterName,
    number
  >;
  if (!redis) return empty;

  const values = await Promise.all(
    names.map((n) => redis.get<number>(counterKey(n, runId, orgId)))
  );
  names.forEach((n, i) => {
    empty[n] = values[i] ?? 0;
  });
  return empty;
}

export async function writeRunMeta(run: AuditRun, orgId = run.orgId): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = runMetaKey(run.id, orgId);
  await redis.set(key, JSON.stringify(run), { ex: eventTtlSeconds() });
}

export async function readRunMeta(runId: string, orgId?: string): Promise<AuditRun | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string | AuditRun>(runMetaKey(runId, orgId));
  if (!raw) return null;
  if (typeof raw === "object") return raw as AuditRun;
  try {
    return JSON.parse(raw) as AuditRun;
  } catch {
    return null;
  }
}

function counterKey(name: CounterName, runId: string, orgId?: string): string {
  if (orgId) {
    if (name === "pagesDiscovered") return tenantScopedKeys.pagesDiscovered(orgId, runId);
    return tenantScopedKeys.auditCounter(orgId, runId, counterKeySegment(name));
  }
  return counterKeys[name](runId);
}

function runMetaKey(runId: string, orgId?: string): string {
  return orgId ? tenantScopedKeys.auditRun(orgId, runId) : metaKeys.auditRun(runId);
}

function counterKeySegment(name: CounterName): string {
  return counterKeys[name]("__run__").split(":").pop() ?? name;
}
