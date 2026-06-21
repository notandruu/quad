import type { WorkflowTaskEventRecord } from "@/lib/runs";
import { getRedis, eventTtlSeconds } from "./client";
import { streamKeys, tenantScopedKeys } from "./keys";

export type PublishedRunTaskEvent = WorkflowTaskEventRecord & {
  orgId?: string;
  storage: "redis" | "memory";
};

const g = globalThis as typeof globalThis & {
  __quadRunTaskEventStreams?: Map<string, PublishedRunTaskEvent[]>;
};
if (!g.__quadRunTaskEventStreams) g.__quadRunTaskEventStreams = new Map();
const memoryRunStreams = g.__quadRunTaskEventStreams;

export async function publishRunTaskEvent(
  event: WorkflowTaskEventRecord,
  options: { orgId?: string } = {}
): Promise<PublishedRunTaskEvent | null> {
  const key = runTaskEventStreamKey(event.runId, options.orgId);
  const published: PublishedRunTaskEvent = {
    ...event,
    payloadSummary: event.payloadSummary ? { ...event.payloadSummary } : undefined,
    orgId: options.orgId,
    storage: "memory",
  };
  const redis = getRedis();
  if (!redis) return publishMemoryRunTaskEvent(key, published);

  const redisEvent: PublishedRunTaskEvent = {
    ...published,
    storage: "redis",
  };
  await redis.xadd(key, "*", { data: redisEvent as unknown as string });
  await redis.expire(key, eventTtlSeconds());
  return redisEvent;
}

export async function replayRunTaskEvents(
  runId: string,
  options: { orgId?: string } = {}
): Promise<PublishedRunTaskEvent[]> {
  const redis = getRedis();
  if (!redis) return getMemoryRunTaskEvents(runId, options);

  const key = runTaskEventStreamKey(runId, options.orgId);
  const entries = (await redis.xrange(key, "-", "+")) as unknown as Record<
    string,
    Record<string, unknown>
  >;

  const events: PublishedRunTaskEvent[] = [];
  for (const fields of Object.values(entries)) {
    const raw = fields?.data;
    if (raw == null) continue;
    try {
      const event = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (isPublishedRunTaskEvent(event)) events.push(event);
    } catch {
      // Ignore malformed stream rows. The durable run ledger remains fallback.
    }
  }

  return events.sort((a, b) => a.sequence - b.sequence);
}

export function getMemoryRunTaskEvents(
  runId: string,
  options: { orgId?: string } = {}
): PublishedRunTaskEvent[] {
  return [...(memoryRunStreams.get(runTaskEventStreamKey(runId, options.orgId)) ?? [])];
}

export function runTaskEventStreamKey(runId: string, orgId?: string): string {
  return orgId ? tenantScopedKeys.runEvents(orgId, runId) : streamKeys.runEvents(runId);
}

function publishMemoryRunTaskEvent(key: string, event: PublishedRunTaskEvent): PublishedRunTaskEvent {
  const events = memoryRunStreams.get(key) ?? [];
  events.push(event);
  memoryRunStreams.set(key, events.slice(-1000));
  return event;
}

function isPublishedRunTaskEvent(value: unknown): value is PublishedRunTaskEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<PublishedRunTaskEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.runId === "string" &&
    typeof event.sequence === "number" &&
    typeof event.kind === "string" &&
    typeof event.actor === "string" &&
    typeof event.message === "string" &&
    typeof event.createdAt === "string"
  );
}
