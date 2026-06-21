import { NextRequest } from "next/server";
import { getMeetingSession } from "@/lib/meeting/sessions";
import { getRedis, eventTtlSeconds } from "@/lib/redis";
import { streamKeys } from "@/lib/redis/keys";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/meeting/stream/[runId]
 *
 * SSE stream of all meeting events for a given run. Replays any events
 * already in Redis, then polls every 2 seconds for new ones. Reuses the
 * same audit event stream key as the audit pipeline so the same Redis
 * infrastructure covers both audit and meeting events.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;
  const redis = getRedis();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected — ignore.
        }
      };

      const session = getMeetingSession(runId);
      if (session) {
        send({ type: "meeting.session", runId, session });
      }

      if (!redis) {
        // No Redis — send current session and close.
        send({ type: "meeting.no_redis", runId });
        controller.close();
        return;
      }

      const key = streamKeys.auditEvents(runId);

      // Replay all events already in the stream (survives page refresh).
      try {
        const existing = (await redis.xrange(key, "-", "+")) as unknown as Record<
          string, Record<string, unknown>
        >;
        for (const fields of Object.values(existing)) {
          const raw = fields?.data;
          if (raw == null) continue;
          try {
            const evt = typeof raw === "string" ? JSON.parse(raw) : raw;
            send(evt);
          } catch {
            // Skip malformed.
          }
        }
      } catch {
        // Redis replay failed — fall through to polling.
      }

      // Poll every 2 seconds for new events, up to maxDuration.
      const pollUntil = Date.now() + 278_000;
      let lastSeenCount = 0;

      while (Date.now() < pollUntil) {
        await sleep(2000);

        try {
          const all = (await redis.xrange(key, "-", "+")) as unknown as Record<
            string, Record<string, unknown>
          >;
          const values = Object.values(all);

          // Only send events we haven't seen yet.
          if (values.length > lastSeenCount) {
            const fresh = values.slice(lastSeenCount);
            lastSeenCount = values.length;

            let ended = false;
            for (const fields of fresh) {
              const raw = fields?.data;
              if (raw == null) continue;
              try {
                const evt = typeof raw === "string" ? JSON.parse(raw) : raw;
                send(evt);
                if (
                  evt &&
                  typeof evt === "object" &&
                  (evt as Record<string, unknown>).type === "meeting.ended"
                ) {
                  ended = true;
                }
              } catch {
                // Skip.
              }
            }

            if (ended) {
              controller.close();
              return;
            }
          }

          // Also check session status so we close when the meeting ends
          // even if the event was already emitted before we started polling.
          const current = getMeetingSession(runId);
          if (current?.status === "ended" || current?.status === "failed") {
            controller.close();
            return;
          }
        } catch {
          // Transient Redis error — keep polling.
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keep the import used.
const _unused = eventTtlSeconds;
void _unused;
