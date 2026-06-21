import { getRedis } from "./client";
import { auditEventStreamKey, getMemoryAuditEvents, type PublishedEvent, type PublishAuditEventOptions } from "./publisher";

type StreamEntry = [id: string, fields: Record<string, string>];

/**
 * Replay every event for an audit run, in order, from the Redis stream.
 * This is what lets the live log survive a page refresh.
 */
export async function replayAuditEvents(
  runId: string,
  options: PublishAuditEventOptions = {}
): Promise<PublishedEvent[]> {
  const redis = getRedis();
  if (!redis) return getMemoryAuditEvents(runId, options);

  const key = auditEventStreamKey(runId, options.orgId);
  // xrange returns entries from oldest to newest.
  const entries = (await redis.xrange(key, "-", "+")) as unknown as Record<
    string,
    Record<string, string>
  >;

  const events: PublishedEvent[] = [];
  for (const fields of Object.values(entries)) {
    const raw = fields?.data;
    if (raw == null) continue;
    try {
      // Upstash auto-parses JSON field values, so raw may already be an object.
      const event = typeof raw === "string" ? JSON.parse(raw) : raw;
      events.push(event as PublishedEvent);
    } catch {
      // Skip malformed entries rather than breaking replay.
    }
  }

  return events.sort((a, b) => a.sequence - b.sequence);
}

export type { StreamEntry };
