import { NextRequest, NextResponse } from "next/server";
import { ingestMemoryWithReceipt, proposeMemoryWrite } from "@/lib/brain";
import { DEMO_ORG_ID } from "@/data/seed";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";

const VALID_SOURCE_TYPES: SourceType[] = ["doc", "meeting", "website", "slack", "email", "manual", "audit"];

function coerceSourceType(raw: unknown): SourceType {
  if (typeof raw === "string" && (VALID_SOURCE_TYPES as string[]).includes(raw)) {
    return raw as SourceType;
  }
  // Graceful aliases
  if (raw === "internal_doc" || raw === "document" || raw === "note") return "doc";
  if (raw === "transcript") return "meeting";
  return "manual";
}

/**
 * Ingest a doc, note, meeting transcript, or manual profile into the company
 * brain. By default this stages an approval-backed memory write proposal; pass
 * mode="write" only for trusted internal callers that should persist directly.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: req.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }
  const fingerprint = buildRequestFingerprint({
    mode: body.mode ?? "proposal",
    title: body.title,
    content: body.content,
    sourceId: body.sourceId,
    sourceType: body.sourceType,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "brain.ingest",
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
    const input = {
      orgId: auth.orgId,
      sourceId: body.sourceId ?? `manual_${Date.now()}`,
      sourceType: coerceSourceType(body.sourceType),
      title: body.title,
      content: body.content,
      summary: body.summary,
      entities: body.entities,
      confidence: body.confidence,
      permissions: body.permissions,
      visibility: body.visibility,
      userId: body.userId,
      teamId: body.teamId,
      teamIds: body.teamIds,
      ownerUserId: body.ownerUserId,
      validationStatus: body.validationStatus,
      sourceUpdatedAt: body.sourceUpdatedAt,
      staleAfter: body.staleAfter,
      relationships: body.relationships,
      relatedSourceIds: body.relatedSourceIds,
      evidence: body.evidence,
    };
    const responseBody = body.mode === "write"
      ? await writeMemoryImmediately(input)
      : await proposeMemoryWrite({
          ...input,
          requestedBy: body.requestedBy === "agent" || body.requestedBy === "system" ? body.requestedBy : "dashboard",
          reason: typeof body.reason === "string" ? body.reason : undefined,
        });
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "brain.ingest",
      headers: req.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function writeMemoryImmediately(input: Parameters<typeof ingestMemoryWithReceipt>[0]) {
  const result = await ingestMemoryWithReceipt(input);
  return {
    ok: true,
    mode: "write" as const,
    id: result.memory.id,
    packet: result.quadChain,
  };
}
