/**
 * Recall.ai integration — creates and manages meeting bots that join
 * Google Meet, Zoom, and Teams calls, then stream real-time transcripts
 * back to the Quad brain pipeline.
 */

// Region detected as us-west-2 for this account.
const RECALL_API_BASE =
  process.env.RECALL_API_REGION
    ? `https://${process.env.RECALL_API_REGION}.recall.ai/api/v1`
    : "https://us-west-2.recall.ai/api/v1";

export type RecallBotStatus =
  | "ready"
  | "joining_call"
  | "in_waiting_room"
  | "in_call_not_recording"
  | "in_call_recording"
  | "call_ended"
  | "done"
  | "fatal";

export type RecallBot = {
  id: string;
  meeting_url: string;
  status: { code: RecallBotStatus };
  bot_name: string;
  join_at: string | null;
  created_at: string;
};

export type RecallTranscriptWord = {
  text: string;
  start_timestamp?: number | { relative?: number; absolute?: string };
  end_timestamp?: number | { relative?: number; absolute?: string } | null;
};

export type RecallTranscriptEntry = {
  speaker: string;
  words: RecallTranscriptWord[];
};

export type RecallTranscriptionProvider =
  | "assembly_ai_v3"
  | "assembly_ai_async_chunked"
  | "aws_transcribe"
  | "deepgram"
  | "meeting_captions"
  | "rev"
  | "recallai"
  | "speechmatics";

export type RecallWebhookEvent = {
  event: string;
  data: {
    bot_id?: string;
    status?: { code: RecallBotStatus };
    transcript?: {
      speaker: string;
      words: RecallTranscriptWord[];
      is_final: boolean;
    };
    data?: {
      words?: RecallTranscriptWord[];
      participant?: {
        name?: string | null;
      };
    };
    bot?: {
      id?: string;
    };
  };
};

export function getRecallSettings(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const apiKey = env.RECALL_API_KEY?.trim() || null;
  const transcriptionProvider = normalizeTranscriptionProvider(env.RECALL_TRANSCRIPTION_PROVIDER);
  return {
    configured: Boolean(apiKey),
    apiKey,
    botName: env.RECALL_BOT_NAME?.trim() || "Quad AI",
    webhookUrl: env.RECALL_WEBHOOK_URL?.trim() || null,
    transcriptionProvider,
  };
}

/**
 * Create a Recall bot and send it to the meeting URL. The bot joins as
 * "Quad AI" and starts recording. Transcripts arrive via webhook at
 * RECALL_WEBHOOK_URL (must be a public HTTPS URL).
 */
export async function createRecallBot(input: {
  meetingUrl: string;
  apiKey: string;
  botName?: string;
  webhookUrl?: string;
  transcriptionProvider?: RecallTranscriptionProvider;
  joinAt?: string;
}): Promise<RecallBot> {
  const transcriptionProvider = input.transcriptionProvider ?? "meeting_captions";
  const webhookEvents = transcriptionProvider === "meeting_captions"
    ? ["transcript.data"]
    : ["transcript.data"];
  const response = await fetch(`${RECALL_API_BASE}/bot/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: input.meetingUrl,
      bot_name: input.botName ?? "Quad AI",
      ...(input.joinAt ? { join_at: input.joinAt } : {}),
      ...(input.webhookUrl
        ? {
            recording_config: {
              transcript: {
                provider: buildTranscriptProvider(transcriptionProvider),
                diarization: {
                  use_separate_streams_when_available: true,
                },
              },
              realtime_endpoints: [
                {
                  type: "webhook",
                  url: input.webhookUrl,
                  events: webhookEvents,
                },
              ],
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Recall bot creation failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<RecallBot>;
}

export async function sendRecallChatMessage(input: {
  botId: string;
  apiKey: string;
  message: string;
  pin?: boolean;
}): Promise<void> {
  const response = await fetch(`${RECALL_API_BASE}/bot/${input.botId}/send_chat_message/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "everyone",
      message: input.message,
      pin: input.pin ?? false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Recall chat message failed (${response.status}): ${body}`);
  }
}

function buildTranscriptProvider(provider: RecallTranscriptionProvider) {
  if (provider === "meeting_captions") return { meeting_captions: {} };
  if (provider === "recallai") {
    return {
      recallai_streaming: {
        mode: "prioritize_low_latency",
        language_code: "en",
      },
    };
  }
  return { [provider]: {} };
}

function normalizeTranscriptionProvider(value?: string | null): RecallTranscriptionProvider {
  const provider = value?.trim();
  switch (provider) {
    case "assembly_ai_v3":
    case "assembly_ai_async_chunked":
    case "aws_transcribe":
    case "deepgram":
    case "meeting_captions":
    case "rev":
    case "recallai":
    case "speechmatics":
      return provider;
    default:
      return "meeting_captions";
  }
}

/**
 * Retrieve the current bot status and transcript from Recall.
 */
export async function getRecallBot(botId: string, apiKey: string): Promise<RecallBot> {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Recall bot fetch failed (${response.status})`);
  }
  return response.json() as Promise<RecallBot>;
}

/**
 * Fetch the full transcript for a completed bot session.
 */
export async function getRecallTranscript(
  botId: string,
  apiKey: string
): Promise<RecallTranscriptEntry[]> {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/transcript/`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Recall transcript fetch failed (${response.status})`);
  }
  const data = (await response.json()) as RecallTranscriptEntry[];
  return Array.isArray(data) ? data : [];
}

/**
 * Remove the bot from the meeting (it leaves and stops recording).
 */
export async function stopRecallBot(botId: string, apiKey: string): Promise<void> {
  await fetch(`${RECALL_API_BASE}/bot/${botId}/leave_call/`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}` },
  });
}

/**
 * Convert a Recall transcript entry into a speaker: text utterance string.
 */
export function recallEntryToText(entry: RecallTranscriptEntry): string {
  return entry.words.map((w) => w.text).join(" ").trim();
}

/**
 * Validate that a string looks like a supported meeting URL.
 */
export function validateMeetingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith("meet.google.com") ||
      parsed.hostname.endsWith("zoom.us") ||
      parsed.hostname.endsWith("teams.microsoft.com") ||
      parsed.hostname.endsWith("webex.com")
    );
  } catch {
    return false;
  }
}
