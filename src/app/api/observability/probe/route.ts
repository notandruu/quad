import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { getObservabilityReadiness, runObservabilityProbe } from "@/lib/observability";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

const ProbeBody = z.object({
  orgId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
    requiredScopes: ["observability:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    authMode: auth.mode,
    observability: getObservabilityReadiness(),
  });
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof ProbeBody>;
  try {
    body = ProbeBody.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid observability probe request." }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
    requiredScopes: ["observability:write"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const probe = await runObservabilityProbe({
    orgId: auth.orgId,
    runId: body.runId,
  });

  return NextResponse.json({
    ok: probe.ok,
    orgId: auth.orgId,
    authMode: auth.mode,
    probe,
  });
}
