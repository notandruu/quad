import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Create a new chat/audit session id. Sessions group a conversation and its
 * audit runs; session state lives in Redis with a TTL.
 *
 * TODO: persist session metadata to Redis (employee:{id}:active_session).
 */
export async function POST(_req: NextRequest) {
  const sessionId = crypto.randomUUID();
  return NextResponse.json({ sessionId, createdAt: new Date().toISOString() });
}
