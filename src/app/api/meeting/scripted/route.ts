import { NextRequest } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { DEMO_MEETING } from "@/data/demo/meeting";
import { createMeetingSession, updateMeetingSession } from "@/lib/meeting/sessions";
import { learnFromMeeting } from "@/lib/skills/learnFromMeeting";
import { publishAuditEvent } from "@/lib/redis/publisher";
import type { PublishedEvent } from "@/lib/redis/publisher";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/meeting/scripted
 *
 * Runs the scripted DEMO_MEETING through the live learning pipeline and
 * streams every step back as SSE events — identical to a real Recall bot
 * session from the frontend's perspective. Use as the one-click demo
 * fallback when Recall or live audio is unavailable on stage.
 *
 * Body: { orgId?: string, title?: string, delayMs?: number }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    orgId?: string;
    title?: string;
    delayMs?: number;
  };

  const orgId = typeof body.orgId === "string" && body.orgId ? body.orgId : DEMO_ORG_ID;
  const title = typeof body.title === "string" && body.title ? body.title : DEMO_MEETING.title;
  // Delay between utterances so the demo feels live. Default 2.5s.
  const delayMs = typeof body.delayMs === "number" ? Math.min(body.delayMs, 8000) : 2500;

  const runId = `meeting_scripted_${crypto.randomUUID()}`;
  createMeetingSession({ runId, orgId, title });
  updateMeetingSession(runId, { status: "live" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected.
        }
      };

      // Forward Redis events to SSE as they're emitted by learnFromMeeting.
      const onEvent = (event: PublishedEvent) => send(event);

      send({ type: "meeting.session", runId, orgId, title, mode: "scripted" });

      try {
        const result = await learnFromMeeting({
          orgId,
          runId,
          title,
          context: DEMO_MEETING.context,
          utterances: DEMO_MEETING.utterances,
          onEvent,
          // Inject a per-utterance delay so the live log scrolls in real time.
          _extractOverride: async (segment, context) => {
            await sleep(delayMs);
            return defaultExtract(segment, context);
          },
        });

        updateMeetingSession(runId, {
          status: "ended",
          endedAt: new Date().toISOString(),
          learnedCount: result.learnedCount,
          rejectedCount: result.rejectedCount,
          transcript: result.transcript,
        });

        send({
          type: "meeting.result",
          runId,
          learnedCount: result.learnedCount,
          rejectedCount: result.rejectedCount,
          summary: result.summary,
          facts: result.facts.map((f) => ({
            claim: f.fact.claim,
            status: f.status,
            confidence: f.confidence,
          })),
        });
      } catch (err) {
        updateMeetingSession(runId, { status: "failed" });
        await publishAuditEvent(runId, "meeting.failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        send({ type: "meeting.failed", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
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

// Lightweight heuristic extract used in the scripted path. The real model-
// backed extract inside learnFromMeeting still runs for judge; this just
// adds the delay so the demo paces naturally.
async function defaultExtract(segment: string, _context: string) {
  const text = segment.includes(":") ? segment.slice(segment.indexOf(":") + 1).trim() : segment;
  const signalful = /\d|percent|deadline|sold out|waitlist|drive|shortage|virtual|launch|shortage|bot/i.test(text);
  if (!signalful || text.length < 24) return [];
  return [{ claim: text, category: "fact", sourceQuote: text }];
}
