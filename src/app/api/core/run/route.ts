import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { runQuadCoreCommand } from "@/lib/core/run";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";
import type { QuadCoreSurface } from "@/lib/core";

export const runtime = "nodejs";
export const maxDuration = 120;

const CoreRunBody = z.object({
  command: z.enum(["chat", "queue_audit"]),
  orgId: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  text: z.string().optional(),
  runId: z.string().min(1).optional(),
  targetUrl: z.string().url().optional(),
  pinnedUrl: z.string().url().optional(),
  hasActiveAudit: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  workflow: z.enum(["website_audit", "enterprise_proof"]).optional(),
  surface: z.enum(["dashboard", "chat", "voice", "fetch_agent", "worker"]).default("dashboard"),
  userId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  teamIds: z.array(z.string().min(1)).optional(),
  includePersonal: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof CoreRunBody>;
  try {
    body = CoreRunBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid core run request." }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
    requiredScopes: body.command === "queue_audit" ? ["jobs:write"] : ["runs:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const fingerprint = buildRequestFingerprint({
    ...body,
    orgId: auth.orgId,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: `core.run.${body.command}`,
    headers: request.headers,
    fingerprint,
    limit: body.command === "queue_audit" ? 20 : 60,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  try {
    const result = await runQuadCoreCommand({
      command: body.command,
      orgId: auth.orgId,
      employeeId: body.employeeId,
      text: body.text,
      runId: body.runId,
      targetUrl: body.targetUrl,
      pinnedUrl: body.pinnedUrl,
      hasActiveAudit: body.hasActiveAudit,
      limit: body.limit,
      workflow: body.workflow,
      surface: body.surface as QuadCoreSurface,
      requester: buildRequester(body),
      createdBy: body.surface === "fetch_agent" ? "agent" : body.surface === "worker" ? "system" : "dashboard",
    });
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: `core.run.${body.command}`,
      headers: request.headers,
      fingerprint,
      body: result,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /required/.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

function buildRequester(body: z.infer<typeof CoreRunBody>) {
  const teamIds = body.teamIds ?? (body.teamId ? [body.teamId] : undefined);
  if (!body.userId && !teamIds?.length && !body.includePersonal) return undefined;
  return {
    userId: body.userId,
    teamIds,
    includePersonal: body.includePersonal === true,
  };
}
