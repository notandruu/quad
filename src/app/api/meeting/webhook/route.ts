import { NextRequest, NextResponse } from "next/server";
import { getDurableMeetingSessionByBotId, updateDurableMeetingSession } from "@/lib/meeting/sessions";
import { recallEntryToText, type RecallWebhookEvent } from "@/lib/meeting/recall";
import { buildMeetingIntelligence } from "@/lib/meeting/intelligence";
import { runMeetingAgentverseHandoff } from "@/lib/meeting/agentverse";
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
  const botId = data.bot_id ?? data.bot?.id ?? "";

  // --- Bot status events ---
  if (event === "bot.status_change" && botId) {
    const session = await getDurableMeetingSessionByBotId(botId);
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
      await publishAuditEvent(session.runId, "meeting.thinking", {
        step: "status",
        detail: `Bot status: ${code ?? "unknown"}`,
      }, { orgId: session.orgId });

      if (status === "ended" && !session.endedAt) {
        await finalizeMeetingSession(session, req.nextUrl.origin);
        await updateDurableMeetingSession(session.runId, {
          status,
          endedAt: new Date().toISOString(),
        });
      } else {
        await updateDurableMeetingSession(session.runId, { status });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // --- Real-time transcript events ---
  if (event === "transcript.data") {
    const legacyTranscript = data.transcript;
    const speaker =
      legacyTranscript?.speaker ??
      data.data?.participant?.name ??
      "Speaker";
    const words = legacyTranscript?.words ?? data.data?.words ?? [];
    const text = recallEntryToText({ speaker, words });

    if (!text || text.length < 8) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const session = await getDurableMeetingSessionByBotId(botId);
    if (!session) {
      return NextResponse.json({ ok: true, skipped: "no durable session" });
    }

    const line = `${speaker}: ${text}`;
    const updatedTranscript = session.transcript
      ? `${session.transcript}\n${line}`
      : line;
    await updateDurableMeetingSession(session.runId, {
      transcript: updatedTranscript,
      status: session.status === "joining" ? "live" : session.status,
    });

    await publishAuditEvent(session.runId, "meeting.transcript", {
      speaker,
      text,
      botId,
    }, { orgId: session.orgId });

    return NextResponse.json({ ok: true, transcript: true });
  }

  return NextResponse.json({ ok: true });
}

async function finalizeMeetingSession(
  session: Awaited<ReturnType<typeof getDurableMeetingSessionByBotId>>,
  origin: string
) {
  if (!session?.transcript.trim()) return;
  const utterances = session.transcript
    .split("\n")
    .map((line) => {
      const splitAt = line.indexOf(":");
      if (splitAt === -1) return { speaker: "Speaker", text: line.trim() };
      return {
        speaker: line.slice(0, splitAt).trim() || "Speaker",
        text: line.slice(splitAt + 1).trim(),
      };
    })
    .filter((line) => line.text.length > 0);

  if (!utterances.length) return;

  const result = await learnFromMeeting({
    orgId: session.orgId,
    runId: session.runId,
    title: session.title,
    utterances,
  }).catch(async (err) => {
    await publishAuditEvent(session.runId, "meeting.failed", {
      error: err instanceof Error ? err.message : String(err),
    }, { orgId: session.orgId });
    return null;
  });

  if (result) {
    await buildMeetingIntelligence(result);
    await runMeetingAgentverseHandoff({
      orgId: session.orgId,
      meetingRunId: session.runId,
      targetUrl: new URL("/demo", origin).toString(),
      workflow: "enterprise_proof",
    });
    await updateDurableMeetingSession(session.runId, {
      learnedCount: result.learnedCount,
      rejectedCount: result.rejectedCount,
    });
  }
}
