import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";
import { buildDataDeletionReceipt, buildRetentionPolicy, DataDeletionError } from "@/lib/security/retention";

export const runtime = "nodejs";

const DeletionBody = z.object({
  orgId: z.string().min(1).optional(),
  scope: z.enum(["org", "run"]).default("run"),
  mode: z.enum(["dry_run", "execute"]).default("dry_run"),
  runId: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
  requestedBy: z.string().min(1).optional(),
  confirmation: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    policy: buildRetentionPolicy({ orgId: auth.orgId }),
    deletion: {
      route: "/api/security/data",
      method: "POST",
      dryRun: {
        scope: "run",
        mode: "dry_run",
        orgId: auth.orgId,
        runId: "run_...",
      },
      execute: {
        scope: "run",
        mode: "execute",
        orgId: auth.orgId,
        runId: "run_...",
        confirmation: `delete:${auth.orgId}:run_...`,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof DeletionBody>;
  try {
    body = DeletionBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid deletion request." }, { status: 400 });
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
    route: "security.data_deletion",
    headers: request.headers,
    fingerprint,
    limit: 10,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  try {
    const receipt = await buildDataDeletionReceipt({
      orgId: auth.orgId,
      scope: body.scope,
      mode: body.mode,
      runId: body.runId,
      sourceId: body.sourceId,
      requestedBy: body.requestedBy,
      confirmation: body.confirmation,
    });
    const responseBody = { ok: true, receipt };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "security.data_deletion",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof DataDeletionError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Deletion request failed." }, { status: 500 });
  }
}
