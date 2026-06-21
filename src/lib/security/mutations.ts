import { tenantKey } from ".";
import { getRedis } from "@/lib/redis";

export type RateLimitResult =
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetAt: string;
    }
  | {
      ok: false;
      status: 429;
      code: "rate_limited";
      error: string;
      limit: number;
      remaining: 0;
      resetAt: string;
    };

export type IdempotencyReplay = {
  key: string;
  status: number;
  body: unknown;
  createdAt: string;
};

export type MutationGuardResult =
  | {
      ok: true;
      rateLimit: Extract<RateLimitResult, { ok: true }>;
      idempotencyKey: string | null;
      replay: null;
    }
  | {
      ok: true;
      rateLimit: Extract<RateLimitResult, { ok: true }>;
      idempotencyKey: string;
      replay: IdempotencyReplay;
    }
  | {
      ok: false;
      status: 409 | 429;
      code: "idempotency_conflict" | "rate_limited";
      error: string;
      rateLimit?: RateLimitResult;
    };

export type MutationGuardInput = {
  orgId: string;
  route: string;
  headers: Headers;
  fingerprint: string;
  env?: Record<string, string | undefined>;
  limit?: number;
  windowSeconds?: number;
};

export type SaveIdempotentResultInput = {
  orgId: string;
  route: string;
  headers: Headers;
  fingerprint: string;
  status?: number;
  body: unknown;
  ttlSeconds?: number;
};

type StoredIdempotencyRecord = {
  key: string;
  orgId: string;
  route: string;
  fingerprint: string;
  status: number;
  body: unknown;
  createdAt: string;
};

const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const memoryIdempotency = new Map<string, StoredIdempotencyRecord>();

export async function checkMutationGuards(input: MutationGuardInput): Promise<MutationGuardResult> {
  const rateLimit = await checkRateLimit(input);
  if (!rateLimit.ok) {
    return {
      ok: false,
      status: rateLimit.status,
      code: rateLimit.code,
      error: rateLimit.error,
      rateLimit,
    };
  }

  const idempotencyKey = normalizeIdempotencyKey(input.headers.get("idempotency-key"));
  if (!idempotencyKey) {
    return { ok: true, rateLimit, idempotencyKey: null, replay: null };
  }

  const existing = await getIdempotencyRecord(input.orgId, input.route, idempotencyKey);
  if (!existing) {
    return { ok: true, rateLimit, idempotencyKey, replay: null };
  }

  if (existing.fingerprint !== input.fingerprint) {
    return {
      ok: false,
      status: 409,
      code: "idempotency_conflict",
      error: "Idempotency key was already used for a different request body.",
      rateLimit,
    };
  }

  return {
    ok: true,
    rateLimit,
    idempotencyKey,
    replay: {
      key: existing.key,
      status: existing.status,
      body: existing.body,
      createdAt: existing.createdAt,
    },
  };
}

export async function saveIdempotentResult(input: SaveIdempotentResultInput): Promise<void> {
  const key = normalizeIdempotencyKey(input.headers.get("idempotency-key"));
  if (!key) return;

  const record: StoredIdempotencyRecord = {
    key,
    orgId: input.orgId,
    route: input.route,
    fingerprint: input.fingerprint,
    status: input.status ?? 200,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  const ttlSeconds = input.ttlSeconds ?? idempotencyTtlSeconds(process.env);
  const storageKey = idempotencyStorageKey(input.orgId, input.route, key);
  memoryIdempotency.set(storageKey, record);
  pruneMemoryIdempotency();

  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(storageKey, record, { ex: ttlSeconds });
  } catch {
    // Memory fallback remains available for local/demo mode.
  }
}

export async function checkRateLimit(input: {
  orgId: string;
  route: string;
  env?: Record<string, string | undefined>;
  limit?: number;
  windowSeconds?: number;
}): Promise<RateLimitResult> {
  const env = input.env ?? process.env;
  const limit = input.limit ?? parsePositiveInt(env.QUAD_MUTATION_RATE_LIMIT, 30);
  const windowSeconds = input.windowSeconds ?? parsePositiveInt(env.QUAD_MUTATION_RATE_WINDOW_SECONDS, 60);
  const now = Date.now();
  const bucket = Math.floor(now / (windowSeconds * 1000));
  const resetAtMs = (bucket + 1) * windowSeconds * 1000;
  const resetAt = new Date(resetAtMs).toISOString();
  const key = tenantKey(input.orgId, "rate", input.route, String(bucket));

  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds + 5);
      return rateLimitDecision(count, limit, resetAt);
    } catch {
      // Fall back to memory if Redis is unavailable at request time.
    }
  }

  const current = memoryRateLimits.get(key);
  if (!current || current.resetAt <= now) {
    memoryRateLimits.set(key, { count: 1, resetAt: resetAtMs });
    pruneMemoryRateLimits(now);
    return rateLimitDecision(1, limit, resetAt);
  }
  current.count += 1;
  return rateLimitDecision(current.count, limit, resetAt);
}

export function buildRequestFingerprint(value: unknown): string {
  return `fnv1a:${fnv1a(stableStringify(value))}`;
}

export function mutationGuardError(result: Exclude<MutationGuardResult, { ok: true }>) {
  return {
    ok: false,
    error: result.error,
    code: result.code,
  };
}

export function idempotencyReplayBody(replay: IdempotencyReplay) {
  if (isPlainObject(replay.body)) {
    return {
      ...replay.body,
      idempotency: {
        replayed: true,
        key: replay.key,
        createdAt: replay.createdAt,
      },
    };
  }

  return {
    ok: true,
    result: replay.body,
    idempotency: {
      replayed: true,
      key: replay.key,
      createdAt: replay.createdAt,
    },
  };
}

function rateLimitDecision(count: number, limit: number, resetAt: string): RateLimitResult {
  if (count > limit) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      error: "Mutation rate limit exceeded.",
      limit,
      remaining: 0,
      resetAt,
    };
  }

  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

async function getIdempotencyRecord(
  orgId: string,
  route: string,
  key: string
): Promise<StoredIdempotencyRecord | null> {
  const storageKey = idempotencyStorageKey(orgId, route, key);
  const memory = memoryIdempotency.get(storageKey);
  if (memory) return memory;

  const redis = getRedis();
  if (!redis) return null;
  try {
    const record = await redis.get<StoredIdempotencyRecord>(storageKey);
    return isStoredIdempotencyRecord(record) ? record : null;
  } catch {
    return null;
  }
}

function idempotencyStorageKey(orgId: string, route: string, key: string): string {
  return tenantKey(orgId, "idempotency", route, key);
}

function normalizeIdempotencyKey(raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "_").slice(0, 120);
}

function idempotencyTtlSeconds(env: Record<string, string | undefined>): number {
  return parsePositiveInt(env.QUAD_IDEMPOTENCY_TTL_SECONDS, 86_400);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isStoredIdempotencyRecord(value: unknown): value is StoredIdempotencyRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as StoredIdempotencyRecord).key === "string" &&
      typeof (value as StoredIdempotencyRecord).fingerprint === "string" &&
      typeof (value as StoredIdempotencyRecord).status === "number"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pruneMemoryRateLimits(now = Date.now()): void {
  for (const [key, value] of memoryRateLimits) {
    if (value.resetAt <= now) memoryRateLimits.delete(key);
  }
}

function pruneMemoryIdempotency(): void {
  if (memoryIdempotency.size <= 500) return;
  const first = memoryIdempotency.keys().next().value;
  if (first) memoryIdempotency.delete(first);
}
