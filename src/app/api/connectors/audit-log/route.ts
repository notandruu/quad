import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { listConnectorCredentialAuditLogs } from "@/lib/connectors";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const limitParam = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 20;

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    auditLogs: await listConnectorCredentialAuditLogs({
      orgId: auth.orgId,
      capabilityId: url.searchParams.get("capabilityId") ?? undefined,
      limit,
    }),
  });
}
