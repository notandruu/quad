import { NextRequest, NextResponse } from "next/server";
import { getMeetingSessionByBotId, updateMeetingSession } from "@/lib/meeting/sessions";
import { recallEntryToText, type RecallWebhookEvent } from "@/lib/meeting/recall";
import { learnFromMeeting } from "@/lib/skills/learnFromMeeting";
import { publishAuditEvent } from "@/lib/redis/publisher";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/meeting/webhook
 *
 * Receives real-time transcript events from Recall.ai and routes them
 * through the learnFromMeeting pipeline. Each final transcript segment
 * is treated as one utterance — extracted, verified, and optionally
 * written to the company brain, with every step emitting a Redis event
 * that the meeting dashboard streams live.
 */
export async function POST(req: NextRequest) {
  let body: RecallWebhookEvent;
  try {
    body = (await req.json()) as RecallWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, data } = body;
  const botId = data.bot_id ?? "";

  // --- Bot status events ---
  if (event === "bot.status_change" && botId) {
    const session = getMeetingSessionByBotId(botId);
    if (session) {
      const code = data.status?.code;
      const status =
        code === "in_call_recording"
          ? "live"
          : code === "call_ended" || code === "done"
            ? "ended"
            : code === "fatal"
              ? "failed"
              : session.status;
      updateMeetingSession(session.runId, { status });
      await publishAuditEvent(session.runId, "meeting.thinking", {
        step: "status",
        detail: `Bot status: ${code ?? "unknown"}`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Real-time transcript events ---
  if (event === "transcript.data" && data.transcript?.is_final) {
    const { transcript } = data;
    const speaker = transcript.speaker ?? "Speaker";
    const text = recallEntryToText({ speaker, words: transcript.words });

    if (!text || text.length < 8) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const session = getMeetingSessionByBotId(botId);
    if (!session) {
      return NextResponse.json({ ok: true, skipped: "no session" });
    }

    const line = `${speaker}: ${text}`;
    const updatedTranscript = session.transcript
      ? `${session.transcript}\n${line}`
      : line;
    updateMeetingSession(session.runId, { transcript: updatedTranscript });

    // Run a single-utterance learn pass and stream every step to Redis.
    const result = await learnFromMeeting({
      orgId: session.orgId,
      runId: session.runId,
      title: session.title,
      utterances: [{ speaker, text }],
    }).catch(async (err) => {
      await publishAuditEvent(session.runId, "meeting.failed", {
        error: err instanceof Error ? err.message : String(err),
        utterance: text,
      });
      return null;
    });

    if (result) {
      updateMeetingSession(session.runId, {
        learnedCount: session.learnedCount + result.learnedCount,
        rejectedCount: session.rejectedCount + result.rejectedCount,
      });
    }

    return NextResponse.json({ ok: true, learned: result?.learnedCount ?? 0 });
  }

  return NextResponse.json({ ok: true });
}
