import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import {
  installConnectorCredential,
  listConnectorCredentials,
  revokeConnectorCredential,
  ConnectorCredentialError,
} from "@/lib/connectors";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";

const InstallBody = z.object({
  orgId: z.string().min(1).optional(),
  capabilityId: z.string().min(1),
  credential: z.record(z.unknown()),
  scopes: z.array(z.string().min(1)).optional(),
  actor: z.string().min(1).optional(),
});

const RevokeBody = z.object({
  orgId: z.string().min(1).optional(),
  installId: z.string().min(1).optional(),
  capabilityId: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
}).refine((body) => Boolean(body.installId || body.capabilityId), {
  message: "installId or capabilityId is required.",
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

  const credentials = await listConnectorCredentials({
    orgId: auth.orgId,
    status: url.searchParams.get("status") === "revoked" ? "revoked" : undefined,
  });
  return NextResponse.json({ ok: true, credentials });
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof InstallBody>;
  try {
    body = InstallBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "capabilityId and credential are required." }, { status: 400 });
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
    capabilityId: body.capabilityId,
    credential: body.credential,
    scopes: body.scopes,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "connectors.credentials.install",
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
    const result = await installConnectorCredential({
      orgId: auth.orgId,
      capabilityId: body.capabilityId,
      credential: body.credential,
      scopes: body.scopes,
      actor: body.actor,
    });
    const responseBody = { ok: true, ...result };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "connectors.credentials.install",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof ConnectorCredentialError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Connector credential install failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let body: z.infer<typeof RevokeBody>;
  try {
    body = RevokeBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "installId or capabilityId is required." }, { status: 400 });
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
    route: "connectors.credentials.revoke",
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
    const result = await revokeConnectorCredential({
      orgId: auth.orgId,
      installId: body.installId,
      capabilityId: body.capabilityId,
      actor: body.actor,
    });
    const responseBody = { ok: true, ...result };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "connectors.credentials.revoke",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof ConnectorCredentialError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Connector credential revoke failed." }, { status: 500 });
  }
}
