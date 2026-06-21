import { NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { getOrgWorkspaceContext, listOrgWorkspaceContexts } from "@/lib/orgs";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedOrgId = url.searchParams.get("orgId") ?? DEMO_ORG_ID;
  const userId = url.searchParams.get("userId");
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId,
    requiredScopes: ["orgs:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const context = await getOrgWorkspaceContext({ orgId: auth.orgId, userId });
  const visible = await listOrgWorkspaceContexts({ orgIds: [auth.orgId], userId, limit: 1 });

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    mode: auth.mode,
    scopes: auth.scopes,
    current: summarizeOrgWorkspaceContext(context),
    orgs: visible.map(summarizeOrgWorkspaceContext),
  });
}

function summarizeOrgWorkspaceContext(context: Awaited<ReturnType<typeof getOrgWorkspaceContext>>) {
  return {
    org: context.org,
    workspace: context.workspace,
    membershipCount: context.memberships.length,
    requester: context.requester,
    boundary: context.boundary,
  };
}
