import { NextResponse } from "next/server";
import { isRedisConfigured } from "@/lib/redis";
import { isBrainConfigured, pingBrain } from "@/lib/brain";
import { isEmbeddingConfigured } from "@/lib/brain/embeddings";
import { getMoshiSettings } from "@/lib/voice/moshi";

export const runtime = "nodejs";

/**
 * Returns which backends are live. Used by the debug drawer to prove the stack
 * is real. Includes brain ping latency so it's obvious when Postgres is slow.
 */
export async function GET() {
  const brainPing = isBrainConfigured() ? await pingBrain() : { ok: false };
  const moshi = getMoshiSettings();

  return NextResponse.json({
    redis: isRedisConfigured(),
    brain: brainPing.ok,
    brainLatencyMs: brainPing.latencyMs,
    embeddings: isEmbeddingConfigured(),
    browserbase: Boolean(
      process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID
    ),
    phoenix: Boolean(process.env.PHOENIX_COLLECTOR_ENDPOINT),
    sentry: Boolean(process.env.SENTRY_DSN),
    voice: moshi.configured,
    voiceClientUrl: moshi.publicClientUrl,
    voiceDecision: moshi.decision,
    voiceNextAction: moshi.nextAction,
    chatModel: process.env.QUAD_CHAT_MODEL ?? "claude-opus-4-8",
    auditModel: process.env.QUAD_AUDIT_MODEL ?? "claude-opus-4-8",
  });
}
