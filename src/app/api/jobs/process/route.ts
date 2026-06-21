import { NextRequest, NextResponse } from "next/server";
import { processNextJob } from "@/lib/jobs/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.QUAD_WORKER_SECRET;
  if (secret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await processNextJob();
  return NextResponse.json({ ok: true, ...result });
}
