import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { POST } from "./route";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("POST /api/voice/transcribe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("turns a Deepgram transcript into a shared core voice answer", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("KALI_CHAT_MODEL", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "What should I fix first on the website?",
                confidence: 0.91,
              },
            ],
          },
        ],
      },
    })));

    const form = new FormData();
    form.append("orgId", DEMO_ORG_ID);
    form.append("runId", "run_voice_core_route");
    form.append("remember", "false");
    form.append("audio", new Blob(["fake audio"], { type: "audio/webm" }), "voice.webm");

    const response = await POST(new NextRequest("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: form,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      provider: "deepgram",
      model: "nova-3",
      transcript: "What should I fix first on the website?",
      memory: null,
      assistant: {
        message: expect.any(String),
        requiresApproval: false,
        quadChain: {
          type: "chat_answer",
          accepted: true,
        },
      },
      evidenceBundle: {
        kind: "voice_audio",
        visibility: "restricted",
        classification: "confidential",
      },
    });
    expect(body.quadChain).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "voice_transcript", accepted: true }),
      expect.objectContaining({ type: "chat_answer", accepted: true }),
    ]));
  });

  it("still returns a guarded setup error when Deepgram is missing", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");

    const response = await POST(new NextRequest("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: new FormData(),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Deepgram is not configured.",
    });
  });
});
