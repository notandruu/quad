import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { captureContextEvents, proposeContextCaptureWrites, summarizeContextCapture } from "@/lib/context-capture";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

const SourceType = z.enum(["doc", "meeting", "website", "slack", "email", "manual", "audit"]);

const CaptureRequestBody = z.object({
  orgId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  sourceName: z.string().min(1).optional(),
  proposeWrites: z.boolean().optional(),
  proposalLimit: z.number().int().min(0).max(10).optional(),
  requestedBy: z.enum(["dashboard", "agent", "system"]).optional(),
  events: z.array(z.object({
    id: z.string().min(1),
    sourceType: SourceType.default("manual"),
    text: z.string().min(1),
    actor: z.string().optional(),
    createdAt: z.string().optional(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof CaptureRequestBody>;
  try {
    body = CaptureRequestBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid context capture request." }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
    requiredScopes: body.proposeWrites ? ["brain:write"] : ["brain:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const fingerprint = buildRequestFingerprint({
    orgId: auth.orgId,
    runId: body.runId,
    sourceName: body.sourceName,
    proposeWrites: body.proposeWrites === true,
    events: body.events.map((event) => ({ id: event.id, text: event.text, sourceType: event.sourceType })),
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "context.capture",
    headers: request.headers,
    fingerprint,
    limit: body.proposeWrites ? 20 : 80,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  try {
    const capture = captureContextEvents({
      orgId: auth.orgId,
      runId: body.runId,
      sourceName: body.sourceName,
      events: body.events,
    });
    const result = body.proposeWrites
      ? await proposeContextCaptureWrites({
          capture,
          requestedBy: body.requestedBy ?? "agent",
          limit: body.proposalLimit,
        })
      : { ...capture, proposals: [] };
    const responseBody = {
      ok: true,
      summary: summarizeContextCapture(capture),
      capture,
      proposals: result.proposals.map((item) => ({
        signalId: item.signalId,
        sourceId: item.sourceId,
        runId: item.proposal.runId,
        approvalId: item.proposal.approvalId,
        packet: item.proposal.packet,
      })),
    };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "context.capture",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Context capture failed." }, { status: 500 });
  }
}
