import { getRedis, eventTtlSeconds } from "./client";
import { counterKeys, metaKeys, type CounterName } from "./keys";
import type { AuditRun } from "@/lib/types";

/**
 * Increment a live progress counter for an audit run. The UI animates these
 * upward as the worker reports progress.
 */
export async function bumpCounter(
  runId: string,
  name: CounterName,
  by = 1
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;

  const key = counterKeys[name](runId);
  const value = await redis.incrby(key, by);
  await redis.expire(key, eventTtlSeconds());
  return value;
}

export async function readCounters(
  runId: string
): Promise<Record<CounterName, number>> {
  const redis = getRedis();
  const names = Object.keys(counterKeys) as CounterName[];
  const empty = Object.fromEntries(names.map((n) => [n, 0])) as Record<
    CounterName,
    number
  >;
  if (!redis) return empty;

  const values = await Promise.all(
    names.map((n) => redis.get<number>(counterKeys[n](runId)))
  );
  names.forEach((n, i) => {
    empty[n] = values[i] ?? 0;
  });
  return empty;
}

export async function writeRunMeta(run: AuditRun): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = metaKeys.auditRun(run.id);
  await redis.set(key, JSON.stringify(run), { ex: eventTtlSeconds() });
}

export async function readRunMeta(runId: string): Promise<AuditRun | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(metaKeys.auditRun(runId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditRun;
  } catch {
    return null;
  }
}
