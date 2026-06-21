import { getRedis } from "@/lib/redis";
import { getWorkerCanaryHealth, type WorkerCanaryHealth } from "./queue";
import { runWorkerCanary, type WorkerCanaryResult } from "./worker";

export type ScheduledWorkerCanaryResult =
  | {
      ok: true;
      scheduled: true;
      skipped: false;
      reason: "ran";
      canary: WorkerCanaryResult;
      nextAllowedAt: string;
    }
  | {
      ok: true;
      scheduled: true;
      skipped: true;
      reason: "recent" | "locked";
      canary: WorkerCanaryHealth;
      nextAllowedAt: string | null;
    };

export type RunScheduledWorkerCanaryInput = {
  orgId?: string;
  minIntervalSeconds?: number;
  lockSeconds?: number;
  now?: string;
};

type CanaryScheduleLock = {
  owner: string;
  expiresAt: string;
};

const CANARY_SCHEDULE_LOCK_KEY = "quad:jobs:worker:canary:schedule-lock";
const DEFAULT_MIN_INTERVAL_SECONDS = 5 * 60;
const DEFAULT_LOCK_SECONDS = 60;

const g = globalThis as typeof globalThis & {
  __quadWorkerCanaryScheduleLock?: CanaryScheduleLock;
};

export async function runScheduledWorkerCanary(
  input: RunScheduledWorkerCanaryInput = {}
): Promise<ScheduledWorkerCanaryResult> {
  const now = input.now ?? new Date().toISOString();
  const minIntervalSeconds = positiveInt(input.minIntervalSeconds, DEFAULT_MIN_INTERVAL_SECONDS);
  const lockSeconds = positiveInt(input.lockSeconds, DEFAULT_LOCK_SECONDS);
  const latest = await getWorkerCanaryHealth();
  const recentNextAllowedAt = nextAllowedAt(latest.lastRunAt, minIntervalSeconds);

  if (recentNextAllowedAt && Date.parse(now) < Date.parse(recentNextAllowedAt)) {
    return {
      ok: true,
      scheduled: true,
      skipped: true,
      reason: "recent",
      canary: latest,
      nextAllowedAt: recentNextAllowedAt,
    };
  }

  const lock = await acquireScheduleLock(lockSeconds);
  if (!lock) {
    return {
      ok: true,
      scheduled: true,
      skipped: true,
      reason: "locked",
      canary: latest,
      nextAllowedAt: recentNextAllowedAt,
    };
  }

  try {
    const canary = await runWorkerCanary({ orgId: input.orgId });
    return {
      ok: true,
      scheduled: true,
      skipped: false,
      reason: "ran",
      canary,
      nextAllowedAt: nextAllowedAt(new Date().toISOString(), minIntervalSeconds) ?? now,
    };
  } finally {
    await releaseScheduleLock(lock.owner);
  }
}

async function acquireScheduleLock(lockSeconds: number): Promise<CanaryScheduleLock | null> {
  const owner = `schedule_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + lockSeconds * 1000).toISOString();
  const existing = g.__quadWorkerCanaryScheduleLock;

  if (existing && Date.parse(existing.expiresAt) > Date.now()) return null;
  g.__quadWorkerCanaryScheduleLock = { owner, expiresAt };

  const redis = getRedis();
  if (!redis) return { owner, expiresAt };

  try {
    const result = await redis.set(CANARY_SCHEDULE_LOCK_KEY, { owner, expiresAt }, {
      nx: true,
      ex: lockSeconds,
    });
    if (result === null) {
      g.__quadWorkerCanaryScheduleLock = undefined;
      return null;
    }
    return { owner, expiresAt };
  } catch {
    return { owner, expiresAt };
  }
}

async function releaseScheduleLock(owner: string): Promise<void> {
  if (g.__quadWorkerCanaryScheduleLock?.owner === owner) {
    g.__quadWorkerCanaryScheduleLock = undefined;
  }

  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(CANARY_SCHEDULE_LOCK_KEY);
  } catch {
    // The lock has a ttl, so expiration is the fallback if release fails.
  }
}

function nextAllowedAt(lastRunAt: string | null, minIntervalSeconds: number): string | null {
  const lastMs = Date.parse(lastRunAt ?? "");
  if (!Number.isFinite(lastMs)) return null;
  return new Date(lastMs + minIntervalSeconds * 1000).toISOString();
}

function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value ?? fallback)) : fallback;
}
