import { getRedis, eventTtlSeconds } from "./client";
import { streamKeys } from "./keys";
import type { KaliEventType } from "./events";

export type PublishedEvent = {
  type: KaliEventType | string;
  payload: Record<string, unknown>;
  sequence: number;
  createdAt: string;
};

/**
 * Append an event to an audit run's stream and set a TTL so demo data
 * self-cleans. Returns the published event (or null when Redis is absent).
 *
 * Sequence is derived from the stream length; the worker is the only writer
 * per run so this stays monotonic for the demo.
 */
export async function publishAuditEvent(
  runId: string,
  type: KaliEventType | string,
  payload: Record<string, unknown> = {}
): Promise<PublishedEvent | null> {
  const redis = getRedis();
  const key = streamKeys.auditEvents(runId);
  const createdAt = new Date().toISOString();

  if (!redis) {
    // Degrade gracefully: still return the event so callers can stream it
    // directly to the client even when no Redis is configured.
    return { type, payload, sequence: -1, createdAt };
  }

  const len = await redis.xlen(key);
  const event: PublishedEvent = { type, payload, sequence: len, createdAt };

  await redis.xadd(key, "*", { data: JSON.stringify(event) });
  await redis.expire(key, eventTtlSeconds());

  return event;
}
