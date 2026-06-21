import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import { buildSecurityPacket } from "@/lib/security/posture";

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

  return NextResponse.json({
    ok: true,
    packet: buildSecurityPacket({ orgId: auth.orgId }),
  });
}
