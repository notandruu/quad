import { NextRequest, NextResponse } from "next/server";
import { processNextJob } from "@/lib/jobs/worker";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = authorizeRequest({
    headers: request.headers,
    requiredSecretEnv: "QUAD_WORKER_SECRET",
    allowDemoFallback: true,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const result = await processNextJob();
  return NextResponse.json({ ok: true, ...result });
}
