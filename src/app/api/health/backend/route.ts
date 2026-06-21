import { NextResponse } from "next/server";
import { getBackendReadiness } from "@/lib/backend/readiness";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: searchParams.get("orgId"),
    allowDemoFallback: true,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const report = await getBackendReadiness();
  return NextResponse.json({
    ...report,
    orgId: auth.orgId,
    authMode: auth.mode,
  });
}
