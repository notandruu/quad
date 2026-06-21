import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { MemoryRefreshError, proposeMemoryRefresh } from "@/lib/brain";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.memoryId && !body.sourceId) {
    return NextResponse.json({ ok: false, error: "memoryId or sourceId required" }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: req.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const fingerprint = buildRequestFingerprint({
    memoryId: body.memoryId,
    sourceId: body.sourceId,
    reason: body.reason,
    nextStaleAfter: body.nextStaleAfter,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "brain.refresh",
    headers: req.headers,
    fingerprint,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  try {
    const responseBody = await proposeMemoryRefresh({
      orgId: auth.orgId,
      memoryId: typeof body.memoryId === "string" ? body.memoryId : undefined,
      sourceId: typeof body.sourceId === "string" ? body.sourceId : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      nextStaleAfter: typeof body.nextStaleAfter === "string" ? body.nextStaleAfter : undefined,
      requestedBy: body.requestedBy === "agent" || body.requestedBy === "system" ? body.requestedBy : "dashboard",
      requester: buildRequester(body),
    });
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "brain.refresh",
      headers: req.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof MemoryRefreshError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function buildRequester(body: Record<string, unknown>) {
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const teamIds = [
    ...(typeof body.teamId === "string" ? [body.teamId] : []),
    ...(Array.isArray(body.teamIds) ? body.teamIds.map(String) : []),
  ];
  return {
    userId,
    teamIds,
    includePersonal: body.includePersonal === true,
  };
}
