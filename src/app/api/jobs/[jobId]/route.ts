import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/queue";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = await getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}
