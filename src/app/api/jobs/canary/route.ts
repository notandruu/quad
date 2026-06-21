import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { runScheduledWorkerCanary } from "@/lib/jobs/scheduler";
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
    requiredScopes: ["worker"],
    allowDemoFallback: true,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  try {
    if (isScheduledCanary(url)) {
      const scheduled = await runScheduledWorkerCanary({
        orgId: auth.orgId,
        minIntervalSeconds: parsePositiveInt(url.searchParams.get("minIntervalSeconds")),
      });
      return NextResponse.json({
        authMode: auth.mode,
        ...scheduled,
      });
    }

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

function isScheduledCanary(url: URL): boolean {
  const value = url.searchParams.get("scheduled") ?? url.searchParams.get("cron");
  return value === "1" || value === "true";
}

function parsePositiveInt(value: string | null): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
