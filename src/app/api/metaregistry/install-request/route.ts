import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import {
  CapabilityInstallRequestError,
  createCapabilityInstallRequest,
} from "@/lib/metaregistry/installRequest";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

const InstallRequestBody = z.object({
  orgId: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  capabilityIds: z.array(z.string().min(1)).optional(),
  includeWriteTools: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof InstallRequestBody>;
  try {
    body = InstallRequestBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid install request." }, { status: 400 });
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
    capabilityIds: body.capabilityIds,
    includeWriteTools: body.includeWriteTools,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "metaregistry.install_request",
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
    const result = await createCapabilityInstallRequest({
      orgId: auth.orgId,
      actor: body.actor,
      capabilityIds: body.capabilityIds,
      includeWriteTools: body.includeWriteTools,
    });
    const responseBody = {
      ok: true,
      ...result,
    };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "metaregistry.install_request",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof CapabilityInstallRequestError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Capability install request failed." }, { status: 500 });
  }
}
