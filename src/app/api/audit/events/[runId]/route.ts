import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { replayAuditEvents, readCounters, readRunMeta } from "@/lib/redis";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Replay all persisted events, counters, and metadata for a run. This is what
 * the frontend calls on page load so the live log survives a refresh.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;
  const requestedOrgId = req.nextUrl.searchParams.get("orgId") ?? DEMO_ORG_ID;
  const auth = authorizeRequest({
    headers: req.headers,
    requestedOrgId,
    requiredScopes: ["runs:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  try {
    const [events, counters, meta] = await Promise.all([
      replayAuditEvents(runId, { orgId: auth.orgId }),
      readCounters(runId, auth.orgId),
      readRunMeta(runId, auth.orgId),
    ]);
    return NextResponse.json({ runId, orgId: auth.orgId, meta, counters, events });
  } catch {
    // A transient Redis error must not break log restore on refresh — degrade
    // to an empty replay so the live stream can still take over.
    return NextResponse.json({ runId, orgId: auth.orgId, meta: null, counters: {}, events: [] });
  }
}
