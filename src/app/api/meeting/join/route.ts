import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { getRecallSettings, createRecallBot, sendRecallChatMessage, validateMeetingUrl } from "@/lib/meeting/recall";
import { createMeetingSession, persistMeetingSession, updateDurableMeetingSession, updateMeetingSession } from "@/lib/meeting/sessions";
import { publishAuditEvent } from "@/lib/redis/publisher";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/meeting/join
 *
 * Sends a Recall.ai bot to a Google Meet (or Zoom / Teams) URL. The bot
 * joins as "Quad AI", starts recording, and streams real-time transcripts
 * back via webhook to /api/meeting/webhook.
 *
 * Body: { meetingUrl: string, orgId?: string, title?: string }
 * Returns: { runId, botId, status, joinUrl }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    meetingUrl?: string;
    orgId?: string;
    title?: string;
  };

  const meetingUrl = typeof body.meetingUrl === "string" ? body.meetingUrl.trim() : "";
  if (!meetingUrl || !validateMeetingUrl(meetingUrl)) {
    return NextResponse.json(
      { error: "meetingUrl is required and must be a Google Meet, Zoom, or Teams URL." },
      { status: 400 }
    );
  }

  const recall = getRecallSettings(process.env);
  if (!recall.configured || !recall.apiKey) {
    return NextResponse.json(
      { error: "Recall.ai is not configured. Set RECALL_API_KEY and RECALL_WEBHOOK_URL." },
      { status: 503 }
    );
  }

  const orgId = typeof body.orgId === "string" && body.orgId ? body.orgId : DEMO_ORG_ID;
  const runId = `meeting_${crypto.randomUUID()}`;
  const title = typeof body.title === "string" && body.title ? body.title : "Live meeting";

  const session = createMeetingSession({ runId, orgId, title, meetingUrl });
  updateMeetingSession(runId, { status: "joining" });
  await persistMeetingSession({ ...session, status: "joining" });

  try {
    const webhookUrl = recall.webhookUrl
      ? `${recall.webhookUrl}/api/meeting/webhook`
      : null;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          error:
            "RECALL_WEBHOOK_URL is not set. The webhook must be a public HTTPS URL so Recall can deliver transcripts. " +
            "Use ngrok or deploy to Vercel to get a public URL.",
        },
        { status: 503 }
      );
    }

    await publishAuditEvent(runId, "meeting.thinking", {
      step: "recall.create",
      detail: "Creating Recall meeting bot with live transcript capture.",
    }, { orgId });

    const bot = await createRecallBot({
      meetingUrl,
      apiKey: recall.apiKey,
      botName: recall.botName,
      webhookUrl,
      transcriptionProvider: recall.transcriptionProvider,
    });

    await updateDurableMeetingSession(runId, { botId: bot.id, status: "joining" });

    await publishAuditEvent(runId, "meeting.started", {
      runId,
      orgId,
      title,
      meetingUrl,
      botId: bot.id,
      botName: recall.botName,
      transcriptionProvider: recall.transcriptionProvider,
    }, { orgId });

    await publishAuditEvent(runId, "meeting.bot.created", {
      botId: bot.id,
      botName: recall.botName,
      detail: "Recall bot created; waiting for meeting admission and transcript events.",
    }, { orgId });

    try {
      await sendRecallChatMessage({
        botId: bot.id,
        apiKey: recall.apiKey,
        message: "Quad AI joined. I am listening for durable company facts and will stage anything important for approval before it updates the brain.",
      });
      await publishAuditEvent(runId, "meeting.chat.sent", {
        botId: bot.id,
        detail: "Posted intro message to the meeting chat.",
      }, { orgId });
    } catch (chatErr) {
      await publishAuditEvent(runId, "meeting.chat.failed", {
        botId: bot.id,
        detail: chatErr instanceof Error ? chatErr.message : String(chatErr),
      }, { orgId });
    }

    return NextResponse.json({
      runId,
      botId: bot.id,
      botName: recall.botName,
      status: "joining",
      meetingUrl,
      streamUrl: `/api/meeting/stream/${runId}`,
    });
  } catch (err) {
    await updateDurableMeetingSession(runId, { status: "failed" });
    await publishAuditEvent(runId, "meeting.failed", {
      error: err instanceof Error ? err.message : String(err),
    }, { orgId });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
