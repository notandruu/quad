import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { buildCapabilityInstallPlan } from "@/lib/metaregistry";
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

  const capabilityIds = url.searchParams.get("capabilities")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const includeWriteTools = url.searchParams.get("includeWriteTools") === "1";
  const plan = buildCapabilityInstallPlan({
    env: process.env,
    orgId: auth.orgId,
    capabilityIds,
    includeWriteTools,
  });

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    plan,
  });
}
