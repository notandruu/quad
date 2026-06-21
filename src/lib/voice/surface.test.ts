import { describe, expect, it } from "vitest";
import { buildVoiceSurfaceCapability } from "./surface";

describe("voice surface capability", () => {
  it("prefers moshi when the websocket is configured", () => {
    expect(
      buildVoiceSurfaceCapability({
        deepgramConfigured: false,
        moshiConfigured: true,
        browserSpeechSupported: true,
        secureContext: true,
      }).mode
    ).toBe("moshi_full_duplex");
  });

  it("prefers deepgram for a sponsor-ready push-to-talk surface", () => {
    expect(
      buildVoiceSurfaceCapability({
        deepgramConfigured: true,
        moshiConfigured: true,
        browserSpeechSupported: true,
        secureContext: true,
      }).mode
    ).toBe("deepgram_stt");
  });

  it("falls back to browser speech recognition for demo-safe voice input", () => {
    const capability = buildVoiceSurfaceCapability({
      deepgramConfigured: false,
      moshiConfigured: false,
      browserSpeechSupported: true,
      secureContext: true,
    });

    expect(capability.mode).toBe("browser_speech_fallback");
    expect(capability.canListen).toBe(true);
    expect(capability.canSpeak).toBe(false);
  });

  it("blocks voice on insecure origins", () => {
    expect(
      buildVoiceSurfaceCapability({
        deepgramConfigured: true,
        moshiConfigured: true,
        browserSpeechSupported: true,
        secureContext: false,
      }).mode
    ).toBe("unavailable");
  });
});
