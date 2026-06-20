import { getRedis } from "./client";
import { streamKeys } from "./keys";
import type { PublishedEvent } from "./publisher";

type StreamEntry = [id: string, fields: Record<string, string>];

/**
 * Replay every event for an audit run, in order, from the Redis stream.
 * This is what lets the live log survive a page refresh.
 */
export async function replayAuditEvents(
  runId: string
): Promise<PublishedEvent[]> {
  const redis = getRedis();
  if (!redis) return [];

  const key = streamKeys.auditEvents(runId);
  // xrange returns entries from oldest to newest.
  const entries = (await redis.xrange(key, "-", "+")) as unknown as Record<
    string,
    Record<string, string>
  >;

  const events: PublishedEvent[] = [];
  for (const fields of Object.values(entries)) {
    if (!fields?.data) continue;
    try {
      events.push(JSON.parse(fields.data) as PublishedEvent);
    } catch {
      // Skip malformed entries rather than breaking replay.
    }
  }

  return events.sort((a, b) => a.sequence - b.sequence);
}

export type { StreamEntry };
