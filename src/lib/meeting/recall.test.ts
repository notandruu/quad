import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecallBot, getRecallSettings } from "./recall";

describe("recall meeting bot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses meeting captions by default so recall does not require deepgram credentials", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        id: "bot_123",
        meeting_url: "https://meet.google.com/abc-defg-hij",
        status: { code: "ready" },
        bot_name: "Quad AI",
        join_at: null,
        created_at: "2026-06-21T00:00:00.000Z",
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createRecallBot({
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      apiKey: "recall_test",
      webhookUrl: "https://quad.test/api/meeting/webhook",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty("transcription_options");
    expect(body).not.toHaveProperty("real_time_transcription");
    expect(body.recording_config).toMatchObject({
      transcript: {
        provider: { meeting_captions: {} },
        diarization: { use_separate_streams_when_available: true },
      },
      realtime_endpoints: [
        {
          type: "webhook",
          url: "https://quad.test/api/meeting/webhook",
          events: ["transcript.data"],
        },
      ],
    });
  });

  it("allows an explicit transcription provider override", () => {
    const settings = getRecallSettings({
      RECALL_API_KEY: "recall_test",
      RECALL_TRANSCRIPTION_PROVIDER: "deepgram",
    });

    expect(settings.transcriptionProvider).toBe("deepgram");
  });
});
