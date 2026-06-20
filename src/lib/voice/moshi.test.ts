import { describe, expect, it } from "vitest";
import { appendTurn, buildVoiceTurn, getMoshiSettings, newVoiceSession } from "./moshi";

describe("getMoshiSettings", () => {
  it("chooses the unconfigured self-host path without a websocket endpoint", () => {
    const settings = getMoshiSettings({});
    expect(settings.configured).toBe(false);
    expect(settings.deployment).toBe("unconfigured");
    expect(settings.nextAction).toContain("MOSHI_SERVER_URL");
  });

  it("accepts websocket endpoints for self-hosted Moshi", () => {
    const settings = getMoshiSettings({
      MOSHI_SERVER_URL: "wss://voice.example.com/moshi",
      NEXT_PUBLIC_MOSHI_SERVER_URL: "wss://voice.example.com/moshi",
    });

    expect(settings.configured).toBe(true);
    expect(settings.deployment).toBe("self_hosted");
    expect(settings.serverUrl).toBe("wss://voice.example.com/moshi");
    expect(settings.publicClientUrl).toBe("wss://voice.example.com/moshi");
  });

  it("rejects non-websocket endpoints", () => {
    const settings = getMoshiSettings({ MOSHI_SERVER_URL: "https://example.com" });
    expect(settings.configured).toBe(false);
    expect(settings.serverUrl).toBeNull();
  });
});

describe("voice sessions", () => {
  it("appends transcript turns immutably", () => {
    const session = newVoiceSession("org_1", "employee_1");
    const turn = buildVoiceTurn("user", "Start an audit", 0.92);
    const next = appendTurn(session, turn);

    expect(session.transcript).toHaveLength(0);
    expect(next.transcript).toEqual([turn]);
  });
});
