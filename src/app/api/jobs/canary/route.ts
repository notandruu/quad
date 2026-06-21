import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { runWorkerCanary } from "@/lib/jobs/worker";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
    requiredSecretEnv: "QUAD_WORKER_SECRET",
    allowDemoFallback: true,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  try {
    const canary = await runWorkerCanary({ orgId: auth.orgId });
    return NextResponse.json({
      ok: canary.ok,
      authMode: auth.mode,
      canary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
