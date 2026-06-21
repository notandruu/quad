import { describe, expect, it, vi } from "vitest";
import { getDeepgramSettings, transcribeWithDeepgram } from "./deepgram";

describe("getDeepgramSettings", () => {
  it("reports unconfigured without an api key", () => {
    const settings = getDeepgramSettings({});
    expect(settings.configured).toBe(false);
    expect(settings.sttModel).toBe("nova-3");
    expect(settings.agentUrl).toBe("wss://agent.deepgram.com/v1/agent/converse");
  });

  it("accepts model and agent overrides", () => {
    const settings = getDeepgramSettings({
      DEEPGRAM_API_KEY: "dg_test",
      DEEPGRAM_STT_MODEL: "flux-general-en",
      DEEPGRAM_TTS_MODEL: "aura-2-orion-en",
      DEEPGRAM_AGENT_URL: "wss://agent.example.com/converse",
    });

    expect(settings.configured).toBe(true);
    expect(settings.sttModel).toBe("flux-general-en");
    expect(settings.ttsModel).toBe("aura-2-orion-en");
    expect(settings.agentUrl).toBe("wss://agent.example.com/converse");
  });
});

describe("transcribeWithDeepgram", () => {
  it("posts audio to deepgram listen and returns the best transcript", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        results: {
          channels: [
            {
              alternatives: [{ transcript: "Start an audit.", confidence: 0.94 }],
            },
          ],
        },
      })
    ) as unknown as typeof fetch;

    const result = await transcribeWithDeepgram({
      audio: new Blob(["audio"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      apiKey: "dg_test",
      model: "nova-3",
      fetcher,
    });

    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("model=nova-3");
    expect(init.headers.Authorization).toBe("Token dg_test");
    expect(result).toEqual({
      provider: "deepgram",
      model: "nova-3",
      transcript: "Start an audit.",
      confidence: 0.94,
    });
  });

  it("throws when deepgram rejects the request", async () => {
    await expect(
      transcribeWithDeepgram({
        audio: new Blob(["audio"], { type: "audio/webm" }),
        mimeType: "audio/webm",
        apiKey: "dg_test",
        fetcher: vi.fn(async () => new Response("bad", { status: 401 })) as unknown as typeof fetch,
      })
    ).rejects.toThrow("status 401");
  });
});
