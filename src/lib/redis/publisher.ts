import { getRedis, eventTtlSeconds } from "./client";
import { streamKeys, tenantScopedKeys } from "./keys";
import type { QuadEventType } from "./events";

export type PublishedEvent = {
  type: QuadEventType | string;
  payload: Record<string, unknown>;
  sequence: number;
  createdAt: string;
  runId?: string;
  orgId?: string;
  storage?: "redis" | "memory";
};

export type PublishAuditEventOptions = {
  orgId?: string;
};

const g = globalThis as typeof globalThis & {
  __quadAuditEventStreams?: Map<string, PublishedEvent[]>;
};
if (!g.__quadAuditEventStreams) g.__quadAuditEventStreams = new Map();
const memoryStreams = g.__quadAuditEventStreams;

/**
 * Append an event to an audit run's stream and set a TTL so demo data
 * self-cleans. Returns the published event (or null when Redis is absent).
 *
 * Sequence is derived from the stream length; the worker is the only writer
 * per run so this stays monotonic for the demo.
 */
export async function publishAuditEvent(
  runId: string,
  type: QuadEventType | string,
  payload: Record<string, unknown> = {},
  options: PublishAuditEventOptions = {}
): Promise<PublishedEvent | null> {
  const redis = getRedis();
  const key = auditEventStreamKey(runId, options.orgId);
  const createdAt = new Date().toISOString();

  if (!redis) {
    return publishMemoryEvent(key, {
      type,
      payload,
      sequence: 0,
      createdAt,
      runId,
      orgId: options.orgId,
      storage: "memory",
    });
  }

  const len = await redis.xlen(key);
  const event: PublishedEvent = {
    type,
    payload,
    sequence: len,
    createdAt,
    runId,
    orgId: options.orgId,
    storage: "redis",
  };

  // Store as plain object — Upstash serializes/deserializes JSON field values
  // automatically, so xrange returns the object directly without JSON.parse.
  await redis.xadd(key, "*", { data: event as unknown as string });
  await redis.expire(key, eventTtlSeconds());

  return event;
}

export function getMemoryAuditEvents(runId: string, options: PublishAuditEventOptions = {}): PublishedEvent[] {
  return [...(memoryStreams.get(auditEventStreamKey(runId, options.orgId)) ?? [])];
}

export function auditEventStreamKey(runId: string, orgId?: string): string {
  return orgId ? tenantScopedKeys.auditEvents(orgId, runId) : streamKeys.auditEvents(runId);
}

function publishMemoryEvent(key: string, event: PublishedEvent): PublishedEvent {
  const events = memoryStreams.get(key) ?? [];
  const stored = {
    ...event,
    sequence: events.length,
  };
  events.push(stored);
  memoryStreams.set(key, events.slice(-500));
  return stored;
}
