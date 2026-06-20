import { NextResponse } from "next/server";
import { isRedisConfigured } from "@/lib/redis";
import { isBrainConfigured } from "@/lib/brain";
import { getMoshiSettings } from "@/lib/voice/moshi";

export const runtime = "nodejs";

/**
 * Surface which backends are wired so the debug drawer can prove the stack is
 * real (Redis, brain, Browserbase, Phoenix, Sentry).
 */
export async function GET() {
  const moshi = getMoshiSettings();

  return NextResponse.json({
    redis: isRedisConfigured(),
    brain: isBrainConfigured(),
    browserbase: Boolean(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID),
    phoenix: Boolean(process.env.PHOENIX_COLLECTOR_ENDPOINT),
    sentry: Boolean(process.env.SENTRY_DSN),
    voice: moshi.configured,
    voiceClientUrl: moshi.publicClientUrl,
    voiceDecision: moshi.decision,
    voiceNextAction: moshi.nextAction,
    chatModel: process.env.KALI_CHAT_MODEL ?? null,
    auditModel: process.env.KALI_AUDIT_MODEL ?? null,
  });
}
