import { NextRequest, NextResponse } from "next/server";
import { getWorkerQueueHealth, getWorkerRuntimeHealth } from "@/lib/jobs/queue";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest({
    headers: request.headers,
    requiredSecretEnv: "QUAD_WORKER_SECRET",
    allowDemoFallback: true,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const [health, runtime] = await Promise.all([
    getWorkerQueueHealth(),
    getWorkerRuntimeHealth(),
  ]);
  return NextResponse.json({
    ok: health.deadLetter === 0 && (!runtime.configured || runtime.alive),
    worker: health,
    runtime,
    authMode: auth.mode,
  });
}
