import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { summarizeCapabilities, summarizeCapabilityCatalog } from "@/lib/metaregistry";
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

  const includeEntries = url.searchParams.get("entries") !== "0";
  const entryLimitParam = Number(url.searchParams.get("limit") ?? 50);
  const entryLimit = Number.isFinite(entryLimitParam) ? Math.max(0, Math.min(entryLimitParam, 100)) : 50;
  const capabilities = summarizeCapabilities(process.env, { orgId: auth.orgId });

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    catalog: summarizeCapabilityCatalog(capabilities, { includeEntries, entryLimit }),
  });
}
