import { NextRequest, NextResponse } from "next/server";
import { replayAuditEvents, readCounters, readRunMeta } from "@/lib/redis";

export const runtime = "nodejs";

/**
 * Replay all persisted events, counters, and metadata for a run. This is what
 * the frontend calls on page load so the live log survives a refresh.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;
  const [events, counters, meta] = await Promise.all([
    replayAuditEvents(runId),
    readCounters(runId),
    readRunMeta(runId),
  ]);
  return NextResponse.json({ runId, meta, counters, events });
}
