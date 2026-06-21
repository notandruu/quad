import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { ApprovedPublishError, executeApprovedPublish } from "@/lib/fde/execution";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

const ExecuteBody = z.object({
  runId: z.string().min(1),
  orgId: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof ExecuteBody>;
  try {
    body = ExecuteBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "runId is required." }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const fingerprint = buildRequestFingerprint({ ...body, orgId: auth.orgId });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "publish.execute",
    headers: request.headers,
    fingerprint,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  try {
    const result = await executeApprovedPublish({
      runId: body.runId,
      orgId: auth.orgId,
      actor: body.actor,
    });
    const responseBody = {
      ok: true,
      task: result.task,
      executed: result.executed.map((item) => ({
        sourceDraft: item.sourceDraft,
        artifact: {
          id: item.artifact.id,
          kind: item.artifact.kind,
          title: item.artifact.title,
          hash: item.artifact.hash,
        },
        receiptId: item.receiptId,
        packet: item.packet,
      })),
      browserActions: result.browserActions.map((item) => ({
        sourceDraft: item.sourceDraft,
        executionArtifactId: item.executionArtifactId,
        artifact: {
          id: item.artifact.id,
          kind: item.artifact.kind,
          title: item.artifact.title,
          hash: item.artifact.hash,
        },
        receiptId: item.receiptId,
        packet: item.packet,
      })),
    };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "publish.execute",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof ApprovedPublishError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Approved publish execution failed." }, { status: 500 });
  }
}
