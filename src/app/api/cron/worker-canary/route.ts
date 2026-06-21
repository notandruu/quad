import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { runScheduledWorkerCanary } from "@/lib/jobs/scheduler";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeCronRequest(request, url);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const scheduled = await runScheduledWorkerCanary({
      orgId: auth.orgId,
      minIntervalSeconds: parsePositiveInt(url.searchParams.get("minIntervalSeconds")) ?? parsePositiveInt(process.env.QUAD_WORKER_CANARY_MIN_INTERVAL_SECONDS),
    });
    return NextResponse.json({
      authMode: auth.mode,
      ...scheduled,
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

function authorizeCronRequest(request: NextRequest, url: URL):
  | { ok: true; orgId: string; mode: "cron_secret" | "secret" | "service_token" | "demo_fallback" }
  | { ok: false; status: 401 | 403; body: { ok: false; error: string; code?: string } } {
  const orgId = url.searchParams.get("orgId") ?? process.env.QUAD_CRON_ORG_ID ?? DEMO_ORG_ID;
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (cronSecret) {
    const authorization = request.headers.get("authorization")?.trim();
    if (authorization !== `Bearer ${cronSecret}`) {
      return {
        ok: false,
        status: 401,
        body: {
          ok: false,
          code: "invalid_cron_secret",
          error: "Invalid cron secret.",
        },
      };
    }
    return { ok: true, orgId, mode: "cron_secret" };
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: orgId,
    requiredSecretEnv: "QUAD_WORKER_SECRET",
    requiredScopes: ["worker"],
    allowDemoFallback: true,
  });
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      body: {
        ...requestAuthError(auth),
        ok: false,
      },
    };
  }
  return { ok: true, orgId: auth.orgId, mode: auth.mode };
}

function parsePositiveInt(value: string | null | undefined): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
