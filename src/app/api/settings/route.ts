import { NextResponse } from "next/server";
import { isRedisConfigured } from "@/lib/redis";
import { isBrainConfigured, pingBrain } from "@/lib/brain";
import { isEmbeddingConfigured } from "@/lib/brain/embeddings";

export const runtime = "nodejs";

/**
 * Returns which backends are live. Used by the debug drawer to prove the stack
 * is real. Includes brain ping latency so it's obvious when Postgres is slow.
 */
export async function GET() {
  const brainPing = isBrainConfigured() ? await pingBrain() : { ok: false };

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
    voice: Boolean(process.env.MOSHI_SERVER_URL),
    chatModel: process.env.KALI_CHAT_MODEL ?? "claude-opus-4-8",
    auditModel: process.env.KALI_AUDIT_MODEL ?? "claude-opus-4-8",
  });
}
