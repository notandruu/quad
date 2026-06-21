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
import { buildRetentionSweepReceipt, DataDeletionError } from "@/lib/security/retention";

export const runtime = "nodejs";

const SweepBody = z.object({
  orgId: z.string().min(1).optional(),
  mode: z.enum(["dry_run", "execute"]).default("dry_run"),
  requestedBy: z.string().min(1).optional(),
  confirmation: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof SweepBody>;
  try {
    body = SweepBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid retention sweep request." }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const fingerprint = buildRequestFingerprint({
    orgId: auth.orgId,
    mode: body.mode,
    limit: body.limit,
    confirmation: body.confirmation,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "security.retention_sweep",
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
    const sweep = await buildRetentionSweepReceipt({
      orgId: auth.orgId,
      mode: body.mode,
      requestedBy: body.requestedBy,
      confirmation: body.confirmation,
      limit: body.limit,
    });
    const responseBody = { ok: true, sweep };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "security.retention_sweep",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof DataDeletionError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Retention sweep failed." }, { status: 500 });
  }
}
